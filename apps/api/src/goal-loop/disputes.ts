import { and, desc, eq } from "drizzle-orm";
import { auditEvents, type Db } from "@datum/db";
import { recordAudit } from "../services/audit";
import { campaignParts } from "../services/campaigns";
import { openDisputes } from "../services/disputes";
import { lockCampaign, moveStatus } from "../services/status";

export async function stopForDispute(db: Db, campaignId: string): Promise<boolean> {
  const [dispute] = openDisputes((await campaignParts(db, campaignId)).expenses);
  if (dispute === undefined) return false;
  await db.transaction(async (tx) => {
    const campaign = await lockCampaign(tx, campaignId);
    if (campaign.status !== "EXECUTING") return;
    await moveStatus(tx, campaignId, "EXECUTING", "NEEDS_APPROVAL");
    await recordAudit(tx, campaignId, {
      type: "APPROVAL_REQUESTED",
      payload: {
        reason: "EXPENSE_DISPUTED",
        expenseId: dispute.id,
        taskId: dispute.physicalTaskId,
        amount: { amountMinor: dispute.amountMinor, currency: dispute.currency },
        explanation: dispute.explanation,
      },
    });
  });
  return true;
}

async function stoppedForDispute(db: Db, campaignId: string): Promise<boolean> {
  const [latest] = await db
    .select({ payload: auditEvents.payload })
    .from(auditEvents)
    .where(and(eq(auditEvents.campaignId, campaignId), eq(auditEvents.type, "APPROVAL_REQUESTED")))
    .orderBy(desc(auditEvents.sequence))
    .limit(1);
  const payload: unknown = latest?.payload;
  return (
    typeof payload === "object" &&
    payload !== null &&
    "reason" in payload &&
    payload.reason === "EXPENSE_DISPUTED"
  );
}

export async function resumeAfterDispute(db: Db, campaignId: string): Promise<void> {
  if (!(await stoppedForDispute(db, campaignId))) return;
  if (openDisputes((await campaignParts(db, campaignId)).expenses).length > 0) return;
  await db.transaction(async (tx) => {
    const campaign = await lockCampaign(tx, campaignId);
    if (campaign.status === "NEEDS_APPROVAL") {
      await moveStatus(tx, campaignId, "NEEDS_APPROVAL", "EXECUTING");
    }
  });
}
