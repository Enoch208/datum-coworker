import { parseStoredReceipt, storedReceipt } from "@datum/api/campaign-service";
import { formatMoney, isFinalStatus, type CampaignReceipt } from "@datum/core";
import { campaigns, type Executor } from "@datum/db";
import { assertAsciiSafeResult } from "@datum/masumi";
import { eq } from "drizzle-orm";
import { canonicalReceiptUrl, campaignPageUrl, singaporeTime } from "./texts";

export interface PublishedReceipt {
  readonly receipt: CampaignReceipt;
  readonly sha256: string;
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
  return row === null ? null : { receipt: parseStoredReceipt(row), sha256: row.sha256 };
}

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

export function resultText({ receipt, sha256 }: PublishedReceipt, appBaseUrl: string): string {
  const brand = printable(receipt.campaignName);
  const text = `Datum campaign ${receipt.campaignId}${brand.length > 0 ? ` for ${brand}` : ""} ended ${receipt.status}: ${outcome(receipt)}. Campaign Receipt sha256 ${sha256}, exact bytes ${canonicalReceiptUrl(appBaseUrl, receipt.campaignId)}, receipt page ${campaignPageUrl(appBaseUrl, receipt.campaignId)}`;
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
  return resultText(finished, appBaseUrl);
}
