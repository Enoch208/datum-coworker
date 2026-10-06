import type {
  CampaignView,
  CreateCampaignRequest,
  ExpenseView,
  ReceiptReading,
  RunnerTaskView,
} from "@datum/core";
import { expect } from "vitest";
import { createApp } from "../../src/app";
import { receiptModelId, type ReceiptReader } from "../../src/receipts/reader";
import { runPass } from "../goal-loop/loop";
import { receiptPhoto } from "../receipts/receipt-image";
import { call, testDeps } from "../support";
import { startedCampaign, taskFor, type StartedCampaign } from "./campaign";
import { jpegFile, postForm, runnerCall, taskPath } from "./calls";

export const purchaseReading = (total: string): ReceiptReading => ({
  readable: true,
  isPurchaseReceipt: true,
  total,
  currency: "SGD",
  merchant: "PRINT HUB PTE LTD",
  concerns: [],
});

export const fixedReader = (reading: ReceiptReading): ReceiptReader => ({
  read: () => Promise.resolve({ model: receiptModelId, reading }),
});

export async function sendPrintReceipt(
  started: StartedCampaign,
  amount: string,
  reading: ReceiptReading = purchaseReading(amount),
) {
  const print = taskFor(started.campaign, null).id;
  const { token } = started.runner;
  await runnerCall<RunnerTaskView>("POST", taskPath(token, print, "accept"));
  const reader = createApp(testDeps({ receiptReader: fixedReader(reading) }));
  const photo = await receiptPhoto({ merchant: "PRINT HUB PTE LTD", total: amount });
  return postForm<ExpenseView>(
    taskPath(token, print, "expense"),
    { receipt: jpegFile(photo, "receipt.jpg"), amount, merchant: "Print Hub" },
    reader,
  );
}

export const campaignNow = async (campaignId: string): Promise<CampaignView> =>
  (await call<CampaignView>("GET", `/campaigns/${campaignId}`)).body;

export async function finishPrint(started: StartedCampaign, amount: string) {
  const sent = await sendPrintReceipt(started, amount);
  expect(sent.body.status).toBe("CONFIRMED");
  const print = taskFor(started.campaign, null).id;
  return runnerCall<RunnerTaskView>("POST", taskPath(started.runner.token, print, "complete"));
}

export async function printedCampaign(
  overrides: Partial<CreateCampaignRequest> = {},
  printAmount = "6.00",
): Promise<StartedCampaign> {
  const started = await startedCampaign(overrides);
  const done = await finishPrint(started, printAmount);
  expect(done.status).toBe(200);
  const report = await runPass();
  expect(report.failed).toEqual([]);
  return { ...started, campaign: await campaignNow(started.campaign.id) };
}
