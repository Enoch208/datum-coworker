import { describe, expect, it } from "vitest";
import { checkBudget, confirmedSpend, remainingBudget, type LedgerExpense } from "../src/budget";
import type { ExpenseStatus, Money } from "../src/contract";

const sgd = (amountMinor: number): Money => ({ amountMinor, currency: "SGD" });
const expense = (amountMinor: number, status: ExpenseStatus): LedgerExpense => ({
  amount: sgd(amountMinor),
  status,
});

const approvedBudget = sgd(5000);
const printingAndRunner = [expense(1380, "CONFIRMED"), expense(2000, "CONFIRMED")];

describe("confirmedSpend", () => {
  it("counts only CONFIRMED expenses", () => {
    const ledger = [...printingAndRunner, expense(800, "SUBMITTED"), expense(500, "DISPUTED")];
    expect(confirmedSpend(ledger, "SGD")).toEqual(sgd(3380));
  });

  it("is zero for an empty ledger", () => {
    expect(confirmedSpend([], "SGD")).toEqual(sgd(0));
  });
});

describe("remainingBudget", () => {
  it("subtracts confirmed and committed open spend from the approved budget", () => {
    const position = { approvedBudget, expenses: printingAndRunner, committedOpenSpend: sgd(800) };
    expect(remainingBudget(position)).toEqual(sgd(820));
  });
});

describe("checkBudget", () => {
  it("proceeds when the recovery action fits inside the approved budget", () => {
    const decision = checkBudget({
      approvedBudget,
      expenses: printingAndRunner,
      committedOpenSpend: sgd(0),
      estimatedActionCost: sgd(800),
    });
    expect(decision).toEqual({ decision: "PROCEED" });
  });

  it("proceeds when the total lands exactly on the approved budget", () => {
    const decision = checkBudget({
      approvedBudget,
      expenses: printingAndRunner,
      committedOpenSpend: sgd(820),
      estimatedActionCost: sgd(800),
    });
    expect(decision).toEqual({ decision: "PROCEED" });
  });

  it("needs approval when the total is one cent over the budget", () => {
    const decision = checkBudget({
      approvedBudget,
      expenses: printingAndRunner,
      committedOpenSpend: sgd(821),
      estimatedActionCost: sgd(800),
    });
    expect(decision).toEqual({
      decision: "NEEDS_APPROVAL",
      shortfall: sgd(1),
      revisedMaximum: sgd(5001),
    });
  });

  it("needs approval for a SGD 9 fix when only SGD 4 remains", () => {
    const decision = checkBudget({
      approvedBudget,
      expenses: [...printingAndRunner, expense(1220, "CONFIRMED")],
      committedOpenSpend: sgd(0),
      estimatedActionCost: sgd(900),
    });
    expect(decision).toEqual({
      decision: "NEEDS_APPROVAL",
      shortfall: sgd(500),
      revisedMaximum: sgd(5500),
    });
  });

  it("counts committed open spend against the budget", () => {
    const decision = checkBudget({
      approvedBudget,
      expenses: printingAndRunner,
      committedOpenSpend: sgd(1000),
      estimatedActionCost: sgd(800),
    });
    expect(decision).toMatchObject({ decision: "NEEDS_APPROVAL", shortfall: sgd(180) });
  });

  it("ignores SUBMITTED and DISPUTED expenses as confirmed spend", () => {
    const decision = checkBudget({
      approvedBudget,
      expenses: [...printingAndRunner, expense(4000, "SUBMITTED"), expense(4000, "DISPUTED")],
      committedOpenSpend: sgd(0),
      estimatedActionCost: sgd(800),
    });
    expect(decision).toEqual({ decision: "PROCEED" });
  });
});
