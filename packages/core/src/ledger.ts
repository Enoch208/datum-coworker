import { confirmedSpend, remainingBudget, type LedgerExpense } from "./budget";
import type { Currency, Money, PhysicalTaskStatus } from "./contract";
import { sumMoney } from "./money";

export interface TaskCommitment {
  status: PhysicalTaskStatus;
  committed: Money;
  expenseConfirmed: boolean;
}

export interface LedgerTotals {
  approvedBudget: Money;
  confirmedSpend: Money;
  committedSpend: Money;
  remaining: Money;
}

const releasingStatuses: ReadonlySet<PhysicalTaskStatus> = new Set(["CANCELLED", "EXPIRED"]);

export const holdsCommitment = (task: TaskCommitment): boolean =>
  !releasingStatuses.has(task.status) && !task.expenseConfirmed;

export const committedOpenSpend = (tasks: readonly TaskCommitment[], currency: Currency): Money =>
  sumMoney(
    tasks.filter(holdsCommitment).map((task) => task.committed),
    currency,
  );

export const ledgerTotals = (
  approvedBudget: Money,
  expenses: readonly LedgerExpense[],
  tasks: readonly TaskCommitment[],
): LedgerTotals => {
  const committedSpend = committedOpenSpend(tasks, approvedBudget.currency);
  return {
    approvedBudget,
    confirmedSpend: confirmedSpend(expenses, approvedBudget.currency),
    committedSpend,
    remaining: remainingBudget({ approvedBudget, expenses, committedOpenSpend: committedSpend }),
  };
};
