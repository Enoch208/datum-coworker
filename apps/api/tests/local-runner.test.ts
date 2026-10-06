import { eq } from "drizzle-orm";
import type { PhysicalTaskDraft } from "@datum/core";
import { auditEvents, physicalTasks, spots } from "@datum/db";
import { describe, expect, it } from "vitest";
import { localEnrolledRunner } from "../src/executor/local-runner";
import { approvedCampaign, startedCampaign, taskFor } from "./runners/campaign";
import { enrollTestRunner } from "./runners/enroll";
import { appBaseUrl, db, resetDatabaseBetweenTests, testRates } from "./support";

resetDatabaseBetweenTests();

const rates = testRates.configured ? testRates.rates : null;
if (rates === null) throw new Error("The test rates must be configured");

const executor = () => localEnrolledRunner({ db, appBaseUrl, rates });

const draftFor = (campaignId: string, overrides: Partial<PhysicalTaskDraft> = {}) => ({
  campaignId,
  spotCode: "A",
  type: "PLACE_SPOT" as const,
  attempt: 2,
  idempotencyKey: `campaign:${campaignId}:spot:A:attempt:2`,
  copies: null,
  assetVersion: 1,
  instructions: "Place Spot A's card again.",
  assetUrls: [],
  estimatedCost: { amountMinor: 1_000, currency: "SGD" as const },
  dueBy: new Date(Date.now() + 3_600_000).toISOString(),
  ...overrides,
});

describe("the local enrolled runner adapter", () => {
  it("prices a draft from the explicit rates", async () => {
    const draft = draftFor("cmp_0000000000000000");
    await expect(executor().estimate(draft)).resolves.toEqual({
      amountMinor: 1_000,
      currency: "SGD",
    });
    const print = { ...draft, type: "PRINT_AND_COLLECT" as const, spotCode: null, copies: 4 };
    await expect(executor().estimate(print)).resolves.toEqual({
      amountMinor: 600,
      currency: "SGD",
    });
  });

  it("creates a task once per key and returns the same reference on a retry", async () => {
    await enrollTestRunner();
    const campaign = await approvedCampaign();
    const first = await executor().createTask(draftFor(campaign.id));
    const second = await executor().createTask(draftFor(campaign.id));
    expect(second).toEqual(first);
    expect(first.adapter).toBe("LOCAL_ENROLLED_RUNNER");
    const rows = await db.select().from(physicalTasks);
    expect(rows).toHaveLength(1);
    await expect(executor().getTask(first)).resolves.toMatchObject({ status: "DISPATCHED" });
    await expect(executor().getEvidence(first)).resolves.toEqual([]);
  });

  it("dispatches a task that was persisted but never dispatched, without a duplicate", async () => {
    const runner = await enrollTestRunner();
    const campaign = await approvedCampaign();
    const draft = draftFor(campaign.id);
    const [spot] = await db.select().from(spots).where(eq(spots.code, "A"));
    await db.insert(physicalTasks).values({
      campaignId: campaign.id,
      spotId: spot?.id ?? null,
      type: "PLACE_SPOT",
      adapter: "LOCAL_ENROLLED_RUNNER",
      attempt: 2,
      idempotencyKey: draft.idempotencyKey,
      assetVersion: 1,
      instructions: draft.instructions,
      assetUrls: [],
      estimatedCostMinor: 1_000,
      committedCostMinor: 1_000,
      currency: "SGD",
      dueBy: new Date(draft.dueBy),
      runnerId: runner.view.runner.id,
    });
    const ref = await executor().createTask(draft);
    const rows = await db.select().from(physicalTasks);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: ref.externalRef, status: "DISPATCHED" });
    const dispatched = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.type, "TASK_DISPATCHED"));
    expect(dispatched).toHaveLength(1);
  });

  it("cancels an open task once, releasing its spot attempt as a miss", async () => {
    const { campaign } = await startedCampaign();
    const ref = {
      adapter: "LOCAL_ENROLLED_RUNNER" as const,
      externalRef: taskFor(campaign, "A").id,
    };
    await expect(executor().cancelTask(ref)).resolves.toEqual({ cancelled: true });
    await expect(executor().cancelTask(ref)).resolves.toEqual({ cancelled: false });
    await expect(executor().getTask(ref)).resolves.toMatchObject({ status: "CANCELLED" });
    const [spot] = await db.select().from(spots).where(eq(spots.code, "A"));
    expect(spot).toMatchObject({ status: "MISS", firstPassStatus: "MISS" });
  });

  it("refuses a reference from another adapter", async () => {
    await expect(
      executor().getTask({ adapter: "RENTAHUMAN", externalRef: "rah_1" }),
    ).rejects.toThrow(/cannot read a RENTAHUMAN task/);
  });
});
