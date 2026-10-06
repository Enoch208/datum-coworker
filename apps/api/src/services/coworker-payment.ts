import { eq } from "drizzle-orm";
import { coworkerTasks, type CampaignRow, type Executor } from "@datum/db";

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
