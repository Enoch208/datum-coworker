import { eq } from "drizzle-orm";
import type { CampaignView, TimelineEventView } from "@datum/core";
import { physicalTasks, remediationDecisions } from "@datum/db";
import { describe, expect, it } from "vitest";
import { call, db, resetDatabaseBetweenTests } from "../support";
import {
  fieldCampaign,
  markDoneWithoutValidPhoto,
  placeAndProve,
  refreshed,
  type FieldCampaign,
} from "./field";
import { loopDeps, passStoppedBeforeCreating, passStoppedMidway, runPass } from "./loop";

resetDatabaseBetweenTests();

const fourSpots = ["A", "B", "C", "D"] as const;

const placements = async (campaignId: string) =>
  (await db.select().from(physicalTasks).where(eq(physicalTasks.campaignId, campaignId)))
    .filter((task) => task.type === "PLACE_SPOT")
    .map((task) => task.idempotencyKey)
    .sort();

const statusOf = async (campaignId: string) =>
  (await call<CampaignView>("GET", `/campaigns/${campaignId}`)).body;

const timeline = async (campaignId: string) =>
  (await call<TimelineEventView[]>("GET", `/campaigns/${campaignId}/timeline`)).body;

const firstAttempts = (campaignId: string) =>
  fourSpots.map((code) => `campaign:${campaignId}:spot:${code}:attempt:1`);

async function firstPassWithCMissed(budget: string): Promise<FieldCampaign> {
  const field = await fieldCampaign(fourSpots, budget);
  await placeAndProve(field, "A");
  await placeAndProve(field, "B");
  await markDoneWithoutValidPhoto(field, "C");
  await placeAndProve(field, "D");
  return refreshed(field);
}

describe("the Goal Loop on a real campaign (Gate 6)", () => {
  it("completes a 4 of 4 first pass on its own with no recovery task", async () => {
    const field = await fieldCampaign(fourSpots, "60.00");
    const proofs = [];
    for (const code of fourSpots) proofs.push(await placeAndProve(field, code));
    expect((await statusOf(field.campaign.id)).status).toBe("EXECUTING");
    expect((await runPass()).failed).toEqual([]);
    const done = await statusOf(field.campaign.id);
    expect(done.status).toBe("COMPLETED");
    expect(done.completedAt).toBe(proofs.at(-1)?.submittedAt);
    expect(await placements(field.campaign.id)).toEqual(firstAttempts(field.campaign.id));
    expect(done.spots.map((spot) => [spot.code, spot.status, spot.firstPassStatus])).toEqual(
      fourSpots.map((code) => [code, "PASS", "PASS"]),
    );
    expect(done.tasks.every((task) => task.status === "COMPLETED")).toBe(true);
    expect(done.ledger).toMatchObject({
      confirmedSpend: { amount: "46.00" },
      committedSpend: { amount: "0.00" },
      remaining: { amount: "14.00" },
    });
    expect(await db.select().from(remediationDecisions)).toEqual([]);
  });

  it("recovers a 3 of 4 first pass by commissioning Spot C again, then completes", async () => {
    const field = await firstPassWithCMissed("60.00");
    expect((await runPass()).failed).toEqual([]);
    const recovering = await statusOf(field.campaign.id);
    expect(recovering.status).toBe("EXECUTING");
    const id = field.campaign.id;
    expect(await placements(id)).toEqual(
      [...firstAttempts(id), `campaign:${id}:spot:C:attempt:2`].sort(),
    );
    const recovery = recovering.tasks.find((task) => task.spotCode === "C" && task.attempt === 2);
    expect(recovery?.status).toBe("DISPATCHED");
    expect(recovering.spots.find((spot) => spot.code === "C")).toMatchObject({
      status: "PENDING",
      firstPassStatus: "MISS",
    });
    const proof = await placeAndProve(await refreshed(field), "C", 7);
    expect((await runPass()).failed).toEqual([]);
    const done = await statusOf(id);
    expect(done.status).toBe("COMPLETED");
    expect(done.completedAt).toBe(proof.submittedAt);
    expect(done.spots.map((spot) => [spot.code, spot.status, spot.firstPassStatus])).toEqual([
      ["A", "PASS", "PASS"],
      ["B", "PASS", "PASS"],
      ["C", "PASS", "MISS"],
      ["D", "PASS", "PASS"],
    ]);
    const story = (await timeline(id))
      .filter((event) =>
        ["GOAL_EVALUATED", "GAP_DETECTED", "RECOVERY_CREATED", "STATUS_CHANGED"].includes(
          event.type,
        ),
      )
      .map((event) => event.type);
    expect(story.slice(-9)).toEqual([
      "STATUS_CHANGED",
      "GOAL_EVALUATED",
      "GAP_DETECTED",
      "STATUS_CHANGED",
      "RECOVERY_CREATED",
      "STATUS_CHANGED",
      "STATUS_CHANGED",
      "GOAL_EVALUATED",
      "STATUS_CHANGED",
    ]);
  });

  it("stops at NEEDS_APPROVAL with no recovery task when the remaining budget cannot pay for it", async () => {
    const field = await firstPassWithCMissed("50.00");
    expect((await runPass()).failed).toEqual([]);
    const stopped = await statusOf(field.campaign.id);
    expect(stopped.status).toBe("NEEDS_APPROVAL");
    expect(await placements(field.campaign.id)).toEqual(firstAttempts(field.campaign.id));
    expect(stopped.ledger?.remaining).toEqual({ amount: "4.00", currency: "SGD" });
    const [decision] = await db.select().from(remediationDecisions);
    expect(decision?.verdict).toMatchObject({
      outcome: "NEEDS_APPROVAL",
      planCost: { amountMinor: 1_000, currency: "SGD" },
      shortfall: { amountMinor: 600, currency: "SGD" },
      revisedMaximum: { amountMinor: 5_600, currency: "SGD" },
    });
    expect((await timeline(field.campaign.id)).at(-1)).toMatchObject({
      type: "APPROVAL_REQUESTED",
      actor: "DATUM_RULES",
    });
    await runPass();
    expect(await placements(field.campaign.id)).toEqual(firstAttempts(field.campaign.id));
  });

  it("ends EXPIRED_INCOMPLETE with no recovery once the deadline has passed", async () => {
    const field = await firstPassWithCMissed("60.00");
    const afterDeadline = new Date(new Date(field.campaign.deadline).getTime() + 60_000);
    expect((await runPass(loopDeps({ now: () => afterDeadline }))).failed).toEqual([]);
    const ended = await statusOf(field.campaign.id);
    expect(ended.status).toBe("EXPIRED_INCOMPLETE");
    expect(ended.completedAt).toBeNull();
    expect(await placements(field.campaign.id)).toEqual(firstAttempts(field.campaign.id));
    expect(
      ended.tasks.filter((task) => ["DISPATCHED", "ACCEPTED", "SUBMITTED"].includes(task.status)),
    ).toEqual([]);
    expect(ended.spots.find((spot) => spot.code === "C")?.status).toBe("MISS");
  });

  it("creates exactly one Spot C attempt 2 when the worker dies between the decision and the task", async () => {
    const field = await firstPassWithCMissed("60.00");
    expect(await passStoppedBeforeCreating()).toMatchObject({ name: "AbortError" });
    const id = field.campaign.id;
    expect((await statusOf(id)).status).toBe("REMEDIATING");
    expect(await placements(id)).toEqual(firstAttempts(id));
    const [pending] = await db.select().from(remediationDecisions);
    expect(pending?.appliedAt).toBeNull();
    expect((await runPass()).failed).toEqual([]);
    expect((await statusOf(id)).status).toBe("EXECUTING");
    expect(await placements(id)).toEqual(
      [...firstAttempts(id), `campaign:${id}:spot:C:attempt:2`].sort(),
    );
    expect(await db.select().from(remediationDecisions)).toHaveLength(1);
    await runPass();
    expect(await placements(id)).toHaveLength(5);
  });

  it("creates exactly one Spot C attempt 2 when the worker dies right after creating it", async () => {
    const field = await firstPassWithCMissed("60.00");
    expect(await passStoppedMidway(1)).toMatchObject({ name: "AbortError" });
    const id = field.campaign.id;
    expect((await statusOf(id)).status).toBe("REMEDIATING");
    expect(await placements(id)).toHaveLength(5);
    expect((await runPass()).failed).toEqual([]);
    expect((await statusOf(id)).status).toBe("EXECUTING");
    expect(await placements(id)).toEqual(
      [...firstAttempts(id), `campaign:${id}:spot:C:attempt:2`].sort(),
    );
    const recoveries = (await timeline(id)).filter((event) => event.type === "RECOVERY_CREATED");
    expect(recoveries).toHaveLength(1);
  });
});
