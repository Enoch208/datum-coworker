import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { asCanonical, buildReceipt, canonicalJson, type CampaignReceipt } from "@datum/core";
import { campaignReceipts, type CampaignReceiptRow, type Executor } from "@datum/db";
import { recordAudit } from "./audit";
import { campaignParts } from "./campaigns";
import { receiptFacts } from "./receipt-facts";

export const receiptBytes = (receipt: CampaignReceipt): string =>
  canonicalJson(asCanonical(receipt));

export const sha256Hex = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");

export async function storedReceipt(
  db: Executor,
  campaignId: string,
): Promise<CampaignReceiptRow | null> {
  const [row] = await db
    .select()
    .from(campaignReceipts)
    .where(eq(campaignReceipts.campaignId, campaignId));
  return row ?? null;
}

export async function publishReceipt(
  db: Executor,
  campaignId: string,
  appBaseUrl: string,
): Promise<CampaignReceiptRow> {
  const existing = await storedReceipt(db, campaignId);
  if (existing !== null) return existing;
  const parts = await campaignParts(db, campaignId);
  const receipt = buildReceipt(await receiptFacts(db, parts, appBaseUrl));
  const bytes = receiptBytes(receipt);
  const [row] = await db
    .insert(campaignReceipts)
    .values({ campaignId, status: receipt.status, canonicalJson: bytes, sha256: sha256Hex(bytes) })
    .returning();
  if (row === undefined) throw new Error(`The receipt for ${campaignId} was not stored`);
  await recordAudit(db, campaignId, {
    type: "RECEIPT_PUBLISHED",
    payload: {
      receiptId: row.id,
      sha256: row.sha256,
      status: receipt.status,
      spotsPassed: receipt.actual.spotsPassed,
      required: receipt.target.spots,
      firstPassPassed: receipt.firstPassPassed,
      recoveries: receipt.recoveryActions,
      interventions: receipt.postApprovalInterventions,
      spend: receipt.actual.spend,
    },
  });
  return row;
}
