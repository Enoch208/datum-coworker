import { eq } from "drizzle-orm";
import type { EvidenceView, RunnerTaskView, TimelineEventView } from "@datum/core";
import { expenses, physicalTasks } from "@datum/db";
import { describe, expect, it } from "vitest";
import { taskFor } from "../runners/campaign";
import { jpegFile, phonePhoto, postForm, runnerCall, taskPath } from "../runners/calls";
import { campaignNow, printedCampaign } from "../runners/print";
import type { StartedCampaign } from "../runners/campaign";
import { call, db, resetDatabaseBetweenTests } from "../support";
import { runPass } from "./loop";

resetDatabaseBetweenTests();

async function placeWithPhotoOf(started: StartedCampaign, spotCode: string, cardOf: string) {
  const taskId = taskFor(started.campaign, spotCode).id;
  const { token } = started.runner;
  await runnerCall("POST", taskPath(token, taskId, "accept"));
  await postForm<EvidenceView>(taskPath(token, taskId, "evidence"), {
    photo: jpegFile(await phonePhoto(started.campaign, cardOf)),
  });
  return runnerCall<RunnerTaskView>("POST", taskPath(token, taskId, "complete"));
}

const fees = () => db.select().from(expenses).where(eq(expenses.kind, "AGREED_FEE"));

describe("the agreed runner fee", () => {
  it("is confirmed at exactly the agreed rate when a placement is completed", async () => {
    const started = await printedCampaign();
    const done = await placeWithPhotoOf(started, "A", "A");
    expect(done.body).toMatchObject({ status: "COMPLETED", expense: null });
    const campaign = await campaignNow(started.campaign.id);
    const taskId = taskFor(campaign, "A").id;
    expect(campaign.ledger).toMatchObject({
      confirmedSpend: { amount: "16.00", currency: "SGD" },
      committedSpend: { amount: "10.00", currency: "SGD" },
      remaining: { amount: "24.00", currency: "SGD" },
      expenses: [{ amount: { amount: "6.00" }, status: "CONFIRMED" }],
      agreedFees: [
        {
          taskId,
          spotCode: "A",
          attempt: 1,
          amount: { amount: "10.00", currency: "SGD" },
          merchant: "Runner fee (agreed rate)",
          status: "CONFIRMED",
          explanation:
            "The agreed runner fee of SGD 10.00 for the Spot A placement (attempt 1), owed because the task was completed. The rate was fixed when the task was commissioned, so there is no receipt.",
        },
      ],
    });
    const [row] = await fees();
    expect(row).toMatchObject({ receiptFile: null, contentHash: null, amountMinor: 1_000 });
    const timeline = await call<TimelineEventView[]>("GET", `/campaigns/${campaign.id}/timeline`);
    expect(timeline.body.at(-1)).toMatchObject({
      type: "EXPENSE_CONFIRMED",
      actor: "DATUM_RULES",
    });
  });

  it("is owed for a completed attempt whose photo failed, because the runner did the work", async () => {
    const started = await printedCampaign();
    await placeWithPhotoOf(started, "A", "B");
    expect(await fees()).toHaveLength(1);
  });

  it("is recorded by the worker for a completed placement that has none, once", async () => {
    const { campaign } = await printedCampaign();
    await db
      .update(physicalTasks)
      .set({ status: "COMPLETED" })
      .where(eq(physicalTasks.id, taskFor(campaign, "B").id));
    await runPass();
    await runPass();
    expect((await fees()).map((fee) => fee.amountMinor)).toEqual([1_000]);
  });

  it("can never be stored as a receipt without an image, nor a receipt as a fee", async () => {
    const { campaign } = await printedCampaign();
    const taskId = taskFor(campaign, "A").id;
    const base = {
      campaignId: campaign.id,
      physicalTaskId: taskId,
      amountMinor: 500,
      currency: "SGD" as const,
      explanation: "test",
    };
    await expect(db.insert(expenses).values({ ...base, kind: "RECEIPT" })).rejects.toThrow();
    await expect(
      db.insert(expenses).values({
        ...base,
        kind: "AGREED_FEE",
        receiptFile: `${"a".repeat(32)}.jpg`,
        contentHash: "a".repeat(64),
      }),
    ).rejects.toThrow();
  });
});
