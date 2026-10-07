import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CampaignReceiptView, CampaignView, EnrolledRunnerView } from "@datum/core";
import { sokosumiResultHash, tusdmUnit } from "@datum/masumi";
import { describe, expect, it } from "vitest";
import type { Coworker } from "../src/context";
import { recordedSeller, recordedTxs } from "../../../packages/masumi/tests/fixtures/mps-payment";
import { placeAndProve } from "../../api/tests/goal-loop/field";
import { campaignNow, finishPrint } from "../../api/tests/runners/print";
import type { EnrolledRunner } from "../../api/tests/runners/enroll";
import { harness, operatorKey, resetDatabaseBetweenTests, type Harness } from "./support/harness";
import {
  commentRows,
  evidenceRows,
  hireRow,
  onlyCampaign,
  physicalTaskRows,
  receiptRows,
} from "./support/rows";

resetDatabaseBetweenTests();

const minute = 60_000;

interface Reply<Body> {
  readonly status: number;
  readonly body: Body;
}

async function callApi<Body>(
  h: Harness,
  method: string,
  path: string,
  payload?: unknown,
): Promise<Reply<Body>> {
  const response = await h.api.request(path, {
    method,
    headers: { "content-type": "application/json", "x-operator-key": operatorKey },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const body: unknown = await response.json();
  return { status: response.status, body: body as Body };
}

interface FundedRun {
  readonly h: Harness;
  readonly campaignId: string;
  readonly deadline: Date;
  readonly runner: EnrolledRunner;
}

async function fundedAndApproved(): Promise<FundedRun> {
  const h = harness();
  await h.passesUntil(() => Promise.resolve(h.world.attached !== null), 1_000);
  await h.passesUntil(async () => (await hireRow(h.world.taskId))?.fundsLockedAt != null, 30_000);
  const campaign = await onlyCampaign(h.world.taskId);
  expect(campaign.status).toBe("AWAITING_APPROVAL");
  expect(await physicalTaskRows(campaign.id)).toHaveLength(0);

  const runner = await callApi<EnrolledRunnerView>(h, "POST", "/operator/runners", {
    name: "Ana",
    expiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  });
  expect(runner.status).toBe(201);
  const approved = await callApi<CampaignView>(h, "POST", `/campaigns/${campaign.id}/approve`, {
    assetVersion: 1,
    approvedBy: "Mei Tan",
  });
  expect(approved.body.status).toBe("APPROVED");
  const token = runner.body.inboxUrl.split("/").at(-1) ?? "";
  return {
    h,
    campaignId: campaign.id,
    deadline: campaign.deadline,
    runner: { view: runner.body, token },
  };
}

async function completedWithReceipt(): Promise<FundedRun> {
  const run = await fundedAndApproved();
  const { h, campaignId, deadline, runner } = run;
  await h.pass();
  expect((await onlyCampaign(h.world.taskId)).status).toBe("EXECUTING");
  const printed = await finishPrint({ campaign: await campaignNow(campaignId), runner }, "2.00");
  expect(printed.status).toBe(200);
  await h.loopAt(new Date(h.clock.now()));
  const field = { campaign: await campaignNow(campaignId), runner, codes: ["A", "B"] };
  await placeAndProve(field, "A", 1);
  await placeAndProve(field, "B", 2);
  await h.loopAt(new Date(h.clock.now()));
  expect((await onlyCampaign(h.world.taskId)).status).toBe("COMPLETED");
  expect(await receiptRows(campaignId)).toHaveLength(1);
  h.clock.advance(deadline.getTime() + 2 * minute - h.clock.now());
  return run;
}

async function expiredWithReceipt() {
  const run = await fundedAndApproved();
  const { h, campaignId, deadline } = run;
  await h.pass();
  expect((await onlyCampaign(h.world.taskId)).status).toBe("EXECUTING");
  expect(await physicalTaskRows(campaignId)).toHaveLength(1);

  await h.loopAt(new Date(deadline.getTime() + minute));
  expect((await onlyCampaign(h.world.taskId)).status).toBe("EXPIRED_INCOMPLETE");
  expect(await receiptRows(campaignId)).toHaveLength(1);
  h.clock.advance(deadline.getTime() + 2 * minute - h.clock.now());
  return run;
}

const resultFile = (h: Harness) => join(h.journalDir, `${h.world.taskId}.result.txt`);

const isPaid = (h: Harness) => async () => (await hireRow(h.world.taskId))?.stage === "PAID";

describe("a hired campaign is paid only for a completed outcome bound to its receipt", () => {
  it("starts only after approval and escrow, then submits the receipt and verifies collection", async () => {
    const { h, campaignId, deadline } = await completedWithReceipt();
    await h.passesUntil(isPaid(h), minute, { limit: 120 });

    expect(h.world.calls).toEqual({ start: 1, terms: 1, attach: 1, submit: 1, complete: 1 });
    const [receipt] = await receiptRows(campaignId);
    const saved = await readFile(resultFile(h), "utf8");
    const completion = h.world.events.at(-1);
    expect(completion).toMatchObject({ status: "COMPLETED", comment: saved });
    expect(saved).toContain(`Datum campaign ${campaignId} for Kopi Lab ended COMPLETED`);
    expect(saved).toContain(`Campaign Receipt sha256 ${receipt?.sha256 ?? "missing"}`);
    expect(saved).toContain(`https://datum.test/api/campaigns/${campaignId}/receipt/canonical`);

    const journal = await h.coworker.journal.load(h.world.taskId);
    if (journal?.step !== "verified") throw new Error("journal did not verify");
    expect(h.world.submitted?.hash).toBe(sokosumiResultHash(saved, journal.nonce));
    expect(Number(journal.terms.submitResultTime)).toBe(deadline.getTime() + 30 * minute);

    expect(await evidenceRows(h.world.taskId)).toEqual([
      expect.objectContaining({
        campaignId,
        escrowTxHash: recordedTxs.escrow,
        resultTxHash: recordedTxs.result,
        collectionTxHash: recordedTxs.collection,
        netReceivedAtomic: "1000000",
        collectionConfirmed: true,
      }),
    ]);
    const view = await callApi<CampaignReceiptView>(h, "GET", `/campaigns/${campaignId}/receipt`);
    expect(view.body.masumi).toMatchObject({
      sokosumiTaskId: h.world.taskId,
      resultHash: h.world.submitted?.hash,
      sellerAddress: recordedSeller.sellerAddress,
      tokenUnit: tusdmUnit,
      escrowTxHash: recordedTxs.escrow,
      resultTxHash: recordedTxs.result,
      collectionTxHash: recordedTxs.collection,
      collectionConfirmed: true,
    });
  });

  it("adopts the saved result bytes after a crash between saving them and submitting", async () => {
    const { h } = await completedWithReceipt();
    const crashing: Coworker = {
      ...h.coworker,
      journal: {
        ...h.coworker.journal,
        saveResult: async (taskId, text) => {
          await h.coworker.journal.saveResult(taskId, text);
          throw new Error("process died after writing the result file");
        },
      },
    };
    await h.pass(crashing);
    const firstBytes = await readFile(resultFile(h), "utf8");
    expect(h.world.calls.submit).toBe(0);

    const restarted: Coworker = {
      ...h.coworker,
      campaigns: { ...h.coworker.campaigns, appBaseUrl: "https://elsewhere.test" },
    };
    await h.passesUntil(isPaid(h), minute, { coworker: restarted, limit: 120 });
    expect(h.world.events.at(-1)?.comment).toBe(firstBytes);
    expect(firstBytes).toContain("https://datum.test/api/campaigns/");
    expect(h.world.calls.submit).toBe(1);
  });

  it("ends the Task FAILED and claims nothing when the campaign ran but did not finish", async () => {
    const { h, campaignId } = await expiredWithReceipt();
    await h.pass();
    for (let restart = 0; restart < 3; restart += 1) await h.pass();

    expect(h.world.calls).toMatchObject({ submit: 0, complete: 0 });
    const ended = h.world.events.filter((event) => event.status === "FAILED");
    expect(ended).toHaveLength(1);
    expect(ended[0]?.comment).toMatch(
      /^Datum did not get this campaign done: it did not finish \(0 of 2 spots proven live, status EXPIRED_INCOMPLETE, deadline \d{4}-\d{2}-\d{2} \d{2}:\d{2} SGT\)\. Datum is paid only for a completed campaign, so it submitted no result for this Task's payment and does not claim it\./,
    );
    expect(h.world.taskStatus).toBe("FAILED");
    expect(await hireRow(h.world.taskId)).toMatchObject({
      stage: "ENDED",
      stopReason: `Campaign ${campaignId} ended EXPIRED_INCOMPLETE (NOT_COMPLETED); no result was submitted and the payment is not claimed`,
    });
    expect((await commentRows(h.world.taskId)).map((row) => row.purpose)).toEqual([
      "PROPOSAL",
      "ENDED",
    ]);
  });

  it("refuses to submit a saved result that names a different receipt", async () => {
    const { h, campaignId } = await completedWithReceipt();
    const tampering: Coworker = {
      ...h.coworker,
      journal: {
        ...h.coworker.journal,
        saveResult: async (taskId, text) => {
          const forged = text.replace(/sha256 [0-9a-f]{64}/, `sha256 ${"0".repeat(64)}`);
          await h.coworker.journal.saveResult(taskId, forged);
          throw new Error("process died after writing a forged result file");
        },
      },
    };
    await h.pass(tampering);
    for (let restart = 0; restart < 3; restart += 1) await h.pass();

    expect(h.world.calls.submit).toBe(0);
    expect(await hireRow(h.world.taskId)).toMatchObject({
      stage: "STOPPED",
      stopReason: `The saved result for campaign ${campaignId} does not match its Campaign Receipt (RESULT_NOT_BOUND); Datum refused to submit it`,
    });
  });
});
