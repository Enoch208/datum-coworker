import { eq } from "drizzle-orm";
import type { CampaignView } from "@datum/core";
import {
  campaigns,
  evidence,
  expenses,
  masumiPaymentEvidence,
  physicalTasks,
  runners,
} from "@datum/db";
import { describe, expect, it } from "vitest";
import { insertAsset } from "./rows";
import { createCampaign, db, resetDatabaseBetweenTests } from "./support";

resetDatabaseBetweenTests();

const photoHash = "a".repeat(64);
const storedFile = (digit: string) => `${digit.repeat(32)}.jpg`;

async function campaignWithAsset(): Promise<CampaignView> {
  const campaign = await createCampaign();
  await insertAsset(campaign.id, 1);
  return campaign;
}

const spotIdOf = (campaign: CampaignView, code: string): string => {
  const spot = campaign.spots.find((candidate) => candidate.code === code);
  if (spot === undefined) throw new Error(`Spot ${code} is missing`);
  return spot.id;
};

async function insertTask(
  campaign: CampaignView,
  idempotencyKey: string,
  overrides: Partial<typeof physicalTasks.$inferInsert> = {},
) {
  const [task] = await db
    .insert(physicalTasks)
    .values({
      campaignId: campaign.id,
      spotId: spotIdOf(campaign, "A"),
      type: "PLACE_SPOT",
      adapter: "LOCAL_ENROLLED_RUNNER",
      attempt: 1,
      idempotencyKey,
      assetVersion: 1,
      instructions: "Place the card at Spot A",
      assetUrls: [],
      estimatedCostMinor: 0,
      currency: "SGD",
      dueBy: new Date(Date.now() + 3_600_000),
      ...overrides,
    })
    .returning();
  if (task === undefined) {
    throw new Error("Inserting a physical task returned no row");
  }
  return task;
}

async function insertEvidence(physicalTaskId: string, contentHash: string) {
  await db.insert(evidence).values({
    physicalTaskId,
    contentHash,
    photoFile: storedFile("1"),
    submittedAt: new Date(),
    explanation: "Waiting for a verdict",
  });
}

const spotKey = (campaign: CampaignView) => `campaign:${campaign.id}:spot:A:attempt:1`;

describe("database invariants", () => {
  it("rejects a second physical task with the same idempotency key", async () => {
    const campaign = await campaignWithAsset();
    await insertTask(campaign, spotKey(campaign));
    await expect(insertTask(campaign, spotKey(campaign))).rejects.toMatchObject({
      cause: { code: "23505", constraint_name: "physical_tasks_idempotency_key_unique" },
    });
  });

  it("counts a duplicate evidence upload for the same task only once", async () => {
    const campaign = await campaignWithAsset();
    const task = await insertTask(campaign, spotKey(campaign));
    await insertEvidence(task.id, photoHash);
    await expect(insertEvidence(task.id, photoHash)).rejects.toMatchObject({
      cause: { code: "23505", constraint_name: "evidence_task_content_unique" },
    });
    await insertEvidence(task.id, "b".repeat(64));
    expect(await db.select().from(evidence)).toHaveLength(2);
  });

  it("refuses a campaign budget that is not positive", async () => {
    const campaign = await createCampaign();
    await expect(
      db.insert(campaigns).values({
        brandId: campaign.brand.id,
        message: "Free coffee",
        destinationUrl: "https://kopilab.example",
        deadline: new Date(Date.now() + 3_600_000),
        budgetMinor: 0,
        currency: "SGD",
      }),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint_name: "campaigns_budget_positive" },
    });
  });

  it("stores runner inbox tokens only as a sha256 hash", async () => {
    await expect(
      db.insert(runners).values({
        name: "Ana",
        inboxTokenHash: "plain-runner-token",
        tokenExpiresAt: new Date(Date.now() + 3_600_000),
      }),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint_name: "runners_inbox_token_is_hash" },
    });
  });

  it("ties a placement to a spot and a print run to a copy count", async () => {
    const campaign = await campaignWithAsset();
    await expect(insertTask(campaign, spotKey(campaign), { spotId: null })).rejects.toMatchObject({
      cause: { code: "23514", constraint_name: "physical_tasks_spot_matches_type" },
    });
    const print = { type: "PRINT_AND_COLLECT" as const, spotId: null, copies: null };
    await expect(insertTask(campaign, "print", print)).rejects.toMatchObject({
      cause: { code: "23514", constraint_name: "physical_tasks_copies_match_type" },
    });
  });

  it("never dispatches a local task without a runner", async () => {
    const campaign = await campaignWithAsset();
    const task = await insertTask(campaign, spotKey(campaign));
    await expect(
      db.update(physicalTasks).set({ status: "DISPATCHED" }).where(eq(physicalTasks.id, task.id)),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint_name: "physical_tasks_local_dispatch_has_runner" },
    });
  });

  it("keeps one live expense per task and lets a disputed one be replaced", async () => {
    const campaign = await campaignWithAsset();
    const task = await insertTask(campaign, spotKey(campaign));
    const expense = (digit: string) => ({
      campaignId: campaign.id,
      physicalTaskId: task.id,
      receiptFile: storedFile(digit),
      contentHash: digit.repeat(64),
      amountMinor: 1_380,
      currency: "SGD" as const,
      explanation: "Waiting for review",
    });
    const [first] = await db.insert(expenses).values(expense("1")).returning();
    await expect(db.insert(expenses).values(expense("2"))).rejects.toMatchObject({
      cause: { code: "23505", constraint_name: "expenses_one_live_per_task" },
    });
    await db
      .update(expenses)
      .set({ status: "DISPUTED", decidedAt: new Date() })
      .where(eq(expenses.id, first?.id ?? ""));
    await db.insert(expenses).values(expense("2"));
    expect(await db.select().from(expenses)).toHaveLength(2);
  });

  it("never marks a Masumi collection confirmed without the collection proof", async () => {
    await expect(
      db.insert(masumiPaymentEvidence).values({
        sokosumiTaskId: "task-1",
        paymentId: "payment-1",
        blockchainIdentifier: "chain-1",
        resultHash: "c".repeat(64),
        sellerAddress: "addr_test1",
        tokenUnit: "tUSDM",
        collectionConfirmed: true,
      }),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint_name: "masumi_payment_confirmed_has_proof" },
    });
  });
});
