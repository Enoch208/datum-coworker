import { eq } from "drizzle-orm";
import { campaigns, evidence, masumiPaymentEvidence, physicalTasks } from "@datum/db";
import { describe, expect, it } from "vitest";
import { createCampaign, db, resetDatabaseBetweenTests } from "./support";

resetDatabaseBetweenTests();

const photoHash = "a".repeat(64);

async function insertTask(campaignId: string, idempotencyKey: string) {
  const [task] = await db
    .insert(physicalTasks)
    .values({
      campaignId,
      type: "PLACE_SPOT",
      adapter: "LOCAL_ENROLLED_RUNNER",
      attempt: 1,
      idempotencyKey,
      instructions: "Place the card at Spot A",
      assetUrls: [],
      estimatedCostMinor: 0,
      currency: "SGD",
      dueBy: new Date(Date.now() + 3_600_000),
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
    photoUrl: "evidence/photo.jpg",
    submittedAt: new Date(),
  });
}

describe("database invariants", () => {
  it("rejects a second physical task with the same idempotency key", async () => {
    const { campaign } = await createCampaign();
    const key = `campaign:${campaign.id}:spot:A:attempt:1`;
    await insertTask(campaign.id, key);
    await expect(insertTask(campaign.id, key)).rejects.toMatchObject({
      cause: { code: "23505", constraint_name: "physical_tasks_idempotency_key_unique" },
    });
  });

  it("counts a duplicate evidence upload for the same task only once", async () => {
    const { campaign } = await createCampaign();
    const task = await insertTask(campaign.id, `campaign:${campaign.id}:spot:A:attempt:1`);
    await insertEvidence(task.id, photoHash);
    await expect(insertEvidence(task.id, photoHash)).rejects.toMatchObject({
      cause: { code: "23505", constraint_name: "evidence_task_content_unique" },
    });
    await insertEvidence(task.id, "b".repeat(64));
    expect(await db.select().from(evidence)).toHaveLength(2);
  });

  it("refuses a campaign budget that is not positive", async () => {
    const { campaign } = await createCampaign();
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

  it("stores runner tokens only as a sha256 hash", async () => {
    const { campaign } = await createCampaign();
    const task = await insertTask(campaign.id, `campaign:${campaign.id}:spot:A:attempt:1`);
    await expect(
      db
        .update(physicalTasks)
        .set({ runnerTokenHash: "plain-runner-token", runnerTokenExpiresAt: new Date() })
        .where(eq(physicalTasks.id, task.id)),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint_name: "physical_tasks_runner_token_is_hash" },
    });
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
