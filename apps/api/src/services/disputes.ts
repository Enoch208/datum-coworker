import { and, eq } from "drizzle-orm";
import {
  formatMoney,
  isFinalStatus,
  toWireMoney,
  type AcceptExpenseRequest,
  type CampaignView,
} from "@datum/core";
import { expenses, hasIdShape, type ExpenseRow, type Executor } from "@datum/db";
import type { ApiDeps } from "../deps";
import { conflict, notFound } from "../http/errors";
import { registeredOwnerKey, verifyOwnerSignature } from "../http/owner";
import { recordAudit } from "./audit";
import { campaignDetail } from "./campaigns";
import { recordIntervention } from "./interventions";
import { lockCampaign, moveStatus } from "./status";

export const isLiveExpense = (expense: ExpenseRow): boolean => expense.status !== "DISPUTED";

export const openDisputes = (all: readonly ExpenseRow[]): ExpenseRow[] =>
  all.filter(
    (expense) =>
      expense.status === "DISPUTED" &&
      !all.some((other) => other.physicalTaskId === expense.physicalTaskId && isLiveExpense(other)),
  );

export const budgetAffecting = (all: readonly ExpenseRow[]): ExpenseRow[] => {
  const disputes = new Set(openDisputes(all).map((expense) => expense.id));
  return all.filter((expense) => isLiveExpense(expense) || disputes.has(expense.id));
};

async function disputedExpense(db: Executor, campaignId: string, expenseId: string) {
  if (!hasIdShape("exp", expenseId)) throw notFound("Expense", expenseId);
  const [row] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.campaignId, campaignId)));
  if (row === undefined) throw notFound("Expense", expenseId);
  const siblings = await db
    .select()
    .from(expenses)
    .where(eq(expenses.physicalTaskId, row.physicalTaskId));
  if (!openDisputes(siblings).some((expense) => expense.id === row.id)) {
    throw conflict("NOT_DISPUTED", "Only an open disputed receipt can be accepted");
  }
  return row;
}

async function acceptLocked(
  db: Executor,
  campaignId: string,
  expenseId: string,
  input: AcceptExpenseRequest,
) {
  const campaign = await lockCampaign(db, campaignId);
  if (isFinalStatus(campaign.status)) {
    throw conflict(
      "CAMPAIGN_ENDED",
      `A ${campaign.status} campaign is closed, so its ledger can no longer change`,
    );
  }
  const expense = await disputedExpense(db, campaignId, expenseId);
  const amount = { amountMinor: expense.amountMinor, currency: expense.currency };
  const ownerStatement = verifyOwnerSignature(
    registeredOwnerKey(campaign),
    {
      action: "ACCEPT_EXPENSE",
      campaignId,
      expenseId: expense.id,
      amount: toWireMoney(amount),
      acceptedBy: input.acceptedBy,
      reason: input.reason,
    },
    input.signature,
  );
  const explanation = `${input.acceptedBy} accepted this ${formatMoney(amount)} receipt after review: ${input.reason}`;
  await db
    .update(expenses)
    .set({ status: "CONFIRMED", explanation, decidedAt: new Date() })
    .where(eq(expenses.id, expense.id));
  await recordAudit(db, campaignId, {
    type: "EXPENSE_CONFIRMED",
    payload: { expenseId: expense.id, taskId: expense.physicalTaskId, amount, explanation },
  });
  await recordIntervention(db, {
    campaignId,
    actor: "CUSTOMER",
    actorName: input.acceptedBy,
    action: "EXPENSE_ACCEPTED",
    reason: `accepted a disputed ${formatMoney(amount)} receipt: ${input.reason}`,
    ownerStatement,
    ownerSignature: input.signature,
  });
  if (campaign.status === "NEEDS_APPROVAL") {
    await moveStatus(db, campaignId, "NEEDS_APPROVAL", "EXECUTING");
  }
}

export async function acceptDisputedExpense(
  deps: ApiDeps,
  campaignId: string,
  expenseId: string,
  input: AcceptExpenseRequest,
): Promise<CampaignView> {
  await deps.db.transaction((tx) => acceptLocked(tx, campaignId, expenseId, input));
  return campaignDetail(deps.db, deps.appBaseUrl, campaignId);
}
