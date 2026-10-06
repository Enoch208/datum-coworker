import {
  ledgerTotals,
  toWireMoney,
  type ExpenseView,
  type LedgerView,
  type TaskSummaryView,
} from "@datum/core";
import type { ApprovalRow, ExpenseRow } from "@datum/db";
import type { TaskWithSpot } from "../services/execution-reads";
import { evidenceFileUrl } from "../uploads/files";

export function toExpenseView(expense: ExpenseRow, appBaseUrl: string): ExpenseView {
  return {
    id: expense.id,
    taskId: expense.physicalTaskId,
    amount: toWireMoney({ amountMinor: expense.amountMinor, currency: expense.currency }),
    merchant: expense.merchant,
    status: expense.status,
    receiptUrl: evidenceFileUrl(appBaseUrl, expense.receiptFile),
    explanation: expense.explanation,
  };
}

export function toTaskSummaryView({ task, spotCode }: TaskWithSpot): TaskSummaryView {
  return {
    id: task.id,
    type: task.type,
    spotCode,
    attempt: task.attempt,
    status: task.status,
    adapter: task.adapter,
    dueBy: task.dueBy.toISOString(),
    createdAt: task.createdAt.toISOString(),
  };
}

const confirmedTaskIds = (expenses: readonly ExpenseRow[]): ReadonlySet<string> =>
  new Set(
    expenses
      .filter((expense) => expense.status === "CONFIRMED")
      .map((expense) => expense.physicalTaskId),
  );

export function toLedgerView(
  approval: ApprovalRow,
  tasks: readonly TaskWithSpot[],
  expenses: readonly ExpenseRow[],
  appBaseUrl: string,
): LedgerView {
  const settled = confirmedTaskIds(expenses);
  const totals = ledgerTotals(
    { amountMinor: approval.budgetMinor, currency: approval.currency },
    expenses.map((expense) => ({
      amount: { amountMinor: expense.amountMinor, currency: expense.currency },
      status: expense.status,
    })),
    tasks.map(({ task }) => ({
      status: task.status,
      committed: { amountMinor: task.committedCostMinor, currency: task.currency },
      expenseConfirmed: settled.has(task.id),
    })),
  );
  return {
    approvedBudget: toWireMoney(totals.approvedBudget),
    confirmedSpend: toWireMoney(totals.confirmedSpend),
    committedSpend: toWireMoney(totals.committedSpend),
    remaining: toWireMoney(totals.remaining),
    expenses: expenses.map((expense) => toExpenseView(expense, appBaseUrl)),
  };
}
