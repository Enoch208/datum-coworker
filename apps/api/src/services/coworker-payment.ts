import { eq } from "drizzle-orm";
import type { MasumiPaymentEvidence } from "@datum/core";
import { coworkerTasks, masumiPaymentEvidence, type CampaignRow, type Executor } from "@datum/db";

export type PaymentGate = "NOT_HIRED_THROUGH_A_TASK" | "ESCROW_LOCKED" | "AWAITING_ESCROW";

export async function paymentGate(
  db: Executor,
  campaign: Pick<CampaignRow, "sokosumiTaskId">,
): Promise<PaymentGate> {
  if (campaign.sokosumiTaskId === null) return "NOT_HIRED_THROUGH_A_TASK";
  const [hire] = await db
    .select({ fundsLockedAt: coworkerTasks.fundsLockedAt })
    .from(coworkerTasks)
    .where(eq(coworkerTasks.sokosumiTaskId, campaign.sokosumiTaskId));
  return hire?.fundsLockedAt == null ? "AWAITING_ESCROW" : "ESCROW_LOCKED";
}

export async function campaignPaymentEvidence(
  db: Executor,
  campaignId: string,
): Promise<MasumiPaymentEvidence | null> {
  const [row] = await db
    .select()
    .from(masumiPaymentEvidence)
    .where(eq(masumiPaymentEvidence.campaignId, campaignId));
  if (row === undefined) return null;
  return {
    sokosumiTaskId: row.sokosumiTaskId,
    paymentId: row.paymentId,
    blockchainIdentifier: row.blockchainIdentifier,
    resultHash: row.resultHash,
    sellerAddress: row.sellerAddress,
    tokenUnit: row.tokenUnit,
    collectionTxHash: row.collectionTxHash,
    netReceivedAtomic: row.netReceivedAtomic,
    collectionConfirmed: row.collectionConfirmed,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
  };
}
