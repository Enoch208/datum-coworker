import { createHash } from "node:crypto";
import { parseStoredReceipt, storedReceipt } from "@datum/api/campaign-service";
import {
  formatMoney,
  isFinalStatus,
  receiptBinding,
  settlementVerdict,
  type CampaignReceipt,
  type SettlementVerdict,
} from "@datum/core";
import { campaigns, type Executor } from "@datum/db";
import { assertAsciiSafeResult } from "@datum/masumi";
import { eq } from "drizzle-orm";
import { canonicalReceiptUrl, campaignPageUrl, singaporeTime } from "./texts";

export interface PublishedReceipt {
  readonly receipt: CampaignReceipt;
  readonly sha256: string;
  readonly computedSha256: string;
}

export const ranPhysicalWork = (receipt: CampaignReceipt): boolean =>
  receipt.executorAdapters.length > 0;

export async function finishedCampaign(
  db: Executor,
  campaignId: string,
): Promise<PublishedReceipt | null> {
  const [campaign] = await db
    .select({ status: campaigns.status })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));
  if (campaign === undefined || !isFinalStatus(campaign.status)) return null;
  const row = await storedReceipt(db, campaignId);
  if (row === null) return null;
  return {
    receipt: parseStoredReceipt(row),
    sha256: row.sha256,
    computedSha256: createHash("sha256").update(row.canonicalJson, "utf8").digest("hex"),
  };
}

export const settlementOf = (
  published: PublishedReceipt,
  resultText: string | null,
): SettlementVerdict =>
  settlementVerdict({
    receipt: published.receipt,
    recordedSha256: published.sha256,
    computedSha256: published.computedSha256,
    resultText,
  });

const printable = (text: string): string =>
  text
    .replace(/[^\x20\x21\x23-\x5b\x5d-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function outcome(receipt: CampaignReceipt): string {
  const { target, actual } = receipt;
  const ending =
    actual.completedAt === null
      ? `the ${singaporeTime(target.deadline)} deadline passed`
      : `completed ${singaporeTime(actual.completedAt)}, before the ${singaporeTime(target.deadline)} deadline`;
  return `${String(actual.spotsPassed)} of ${String(target.spots)} spots live with checked photo evidence (first pass ${String(receipt.firstPassPassed)} of ${String(target.spots)}, ${String(receipt.recoveryActions)} recovery actions), confirmed spend ${formatMoney(actual.spend)} of ${formatMoney(target.budget)}, ${ending}`;
}

export function resultText(
  { receipt, sha256 }: Pick<PublishedReceipt, "receipt" | "sha256">,
  appBaseUrl: string,
): string {
  const brand = printable(receipt.campaignName);
  const text = `Datum campaign ${receipt.campaignId}${brand.length > 0 ? ` for ${brand}` : ""} ended ${receipt.status}: ${outcome(receipt)}. ${receiptBinding(sha256)}, exact bytes ${canonicalReceiptUrl(appBaseUrl, receipt.campaignId)}, receipt page ${campaignPageUrl(appBaseUrl, receipt.campaignId)}`;
  assertAsciiSafeResult(text);
  return text;
}

export async function campaignResult(
  db: Executor,
  campaignId: string,
  appBaseUrl: string,
): Promise<string | null> {
  const finished = await finishedCampaign(db, campaignId);
  if (finished === null || !ranPhysicalWork(finished.receipt)) return null;
  if (settlementOf(finished, null).outcome !== "SETTLE") return null;
  const text = resultText(finished, appBaseUrl);
  return settlementOf(finished, text).outcome === "SETTLE" ? text : null;
}
