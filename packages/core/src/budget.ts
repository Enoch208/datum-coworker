import type { Currency, ExpenseStatus, Money } from "./contract";
import { addMoney, compareMoney, subtractMoney, sumMoney } from "./money";

export interface LedgerExpense {
  amount: Money;
  status: ExpenseStatus;
}

export interface BudgetPosition {
  approvedBudget: Money;
  expenses: readonly LedgerExpense[];
  committedOpenSpend: Money;
}

export interface BudgetCheckInput extends BudgetPosition {
  estimatedActionCost: Money;
}

export type BudgetDecision =
  { decision: "PROCEED" } | { decision: "NEEDS_APPROVAL"; shortfall: Money; revisedMaximum: Money };

export const confirmedSpend = (expenses: readonly LedgerExpense[], currency: Currency): Money =>
  sumMoney(
    expenses.filter((expense) => expense.status === "CONFIRMED").map((expense) => expense.amount),
    currency,
  );

const spendSoFar = (position: BudgetPosition): Money =>
  addMoney(
    confirmedSpend(position.expenses, position.approvedBudget.currency),
    position.committedOpenSpend,
  );

export const remainingBudget = (position: BudgetPosition): Money =>
  subtractMoney(position.approvedBudget, spendSoFar(position));

export const checkBudget = (input: BudgetCheckInput): BudgetDecision => {
  const revisedMaximum = addMoney(spendSoFar(input), input.estimatedActionCost);
  if (compareMoney(revisedMaximum, input.approvedBudget) <= 0) return { decision: "PROCEED" };
  return {
    decision: "NEEDS_APPROVAL",
    shortfall: subtractMoney(revisedMaximum, input.approvedBudget),
    revisedMaximum,
  };
};
