import { and, eq, notInArray } from "drizzle-orm";
import { formatMoney, type Money } from "@datum/core";
import { expenses, physicalTasks, spots, type Executor, type PhysicalTaskRow } from "@datum/db";
import { recordAudit } from "./audit";

export const agreedFeeMerchant = "Runner fee (agreed rate)";

const feeExplanation = (amount: Money, spotCode: string, attempt: number): string =>
  `The agreed runner fee of ${formatMoney(amount)} for the Spot ${spotCode} placement (attempt ${String(attempt)}), owed because the task was completed. The rate was fixed when the task was commissioned, so there is no receipt.`;

async function spotCodeOf(db: Executor, task: PhysicalTaskRow): Promise<string> {
  const [spot] = await db
    .select({ code: spots.code })
    .from(spots)
    .where(eq(spots.id, task.spotId ?? ""));
  if (spot === undefined) throw new Error(`Placement ${task.id} has no spot`);
  return spot.code;
}

export async function recordAgreedFee(db: Executor, task: PhysicalTaskRow): Promise<void> {
  if (task.type !== "PLACE_SPOT" || task.status !== "COMPLETED") {
    throw new Error(`Task ${task.id} is not a completed placement, so no runner fee is owed`);
  }
  const amount = { amountMinor: task.estimatedCostMinor, currency: task.currency };
  if (amount.amountMinor === 0) return;
  const explanation = feeExplanation(amount, await spotCodeOf(db, task), task.attempt);
  const [fee] = await db
    .insert(expenses)
    .values({
      campaignId: task.campaignId,
      physicalTaskId: task.id,
      kind: "AGREED_FEE",
      merchant: agreedFeeMerchant,
      amountMinor: amount.amountMinor,
      currency: amount.currency,
      status: "CONFIRMED",
      explanation,
      decidedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: expenses.id });
  if (fee === undefined) return;
  await recordAudit(db, task.campaignId, {
    type: "EXPENSE_CONFIRMED",
    payload: { expenseId: fee.id, taskId: task.id, amount, explanation },
  });
}

export async function settleCompletedPlacements(db: Executor, campaignId: string): Promise<void> {
  const owed = await db
    .select()
    .from(physicalTasks)
    .where(
      and(
        eq(physicalTasks.campaignId, campaignId),
        eq(physicalTasks.type, "PLACE_SPOT"),
        eq(physicalTasks.status, "COMPLETED"),
        notInArray(
          physicalTasks.id,
          db
            .select({ id: expenses.physicalTaskId })
            .from(expenses)
            .where(and(eq(expenses.campaignId, campaignId), eq(expenses.status, "CONFIRMED"))),
        ),
      ),
    );
  for (const task of owed) await recordAgreedFee(db, task);
}
