import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CampaignReceiptView, CampaignView, EnrolledRunnerView } from "@datum/core";
import { sokosumiResultHash, tusdmUnit } from "@datum/masumi";
import { describe, expect, it } from "vitest";
import type { Coworker } from "../src/context";
import { recordedSeller, recordedTxs } from "../../../packages/masumi/tests/fixtures/mps-payment";
import { harness, operatorKey, resetDatabaseBetweenTests, type Harness } from "./support/harness";
import { evidenceRows, hireRow, onlyCampaign, physicalTaskRows, receiptRows } from "./support/rows";

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

async function fundedAndApproved(): Promise<{ h: Harness; campaignId: string; deadline: Date }> {
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
  return { h, campaignId: campaign.id, deadline: campaign.deadline };
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

describe("a hired campaign is paid through its Task with the receipt as the result", () => {
  it("starts only after approval and escrow, then submits the receipt and verifies collection", async () => {
    const { h, campaignId, deadline } = await expiredWithReceipt();
    await h.passesUntil(isPaid(h), minute, { limit: 120 });

    expect(h.world.calls).toEqual({ start: 1, terms: 1, attach: 1, submit: 1, complete: 1 });
    const [receipt] = await receiptRows(campaignId);
    const saved = await readFile(resultFile(h), "utf8");
    const completion = h.world.events.at(-1);
    expect(completion).toMatchObject({ status: "COMPLETED", comment: saved });
    expect(saved).toContain(`Datum campaign ${campaignId} for Kopi Lab ended EXPIRED_INCOMPLETE`);
    expect(saved).toContain(`Campaign Receipt sha256 ${receipt?.sha256 ?? "missing"}`);
    expect(saved).toContain(`https://datum.test/api/campaigns/${campaignId}/receipt/canonical`);

    const journal = await h.coworker.journal.load(h.world.taskId);
    if (journal?.step !== "verified") throw new Error("journal did not verify");
    expect(h.world.submitted?.hash).toBe(sokosumiResultHash(saved, journal.nonce));
    expect(Number(journal.terms.submitResultTime)).toBe(deadline.getTime() + 30 * minute);

    expect(await evidenceRows(h.world.taskId)).toEqual([
      expect.objectContaining({
        campaignId,
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
      collectionTxHash: recordedTxs.collection,
      collectionConfirmed: true,
    });
  });

  it("adopts the saved result bytes after a crash between saving them and submitting", async () => {
    const { h } = await expiredWithReceipt();
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
});
