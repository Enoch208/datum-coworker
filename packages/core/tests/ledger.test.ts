import { describe, expect, it } from "vitest";
import type { LedgerExpense } from "../src/budget";
import type { Money, PhysicalTaskStatus } from "../src/contract";
import { committedOpenSpend, ledgerTotals, type TaskCommitment } from "../src/ledger";

const sgd = (amountMinor: number): Money => ({ amountMinor, currency: "SGD" });

const task = (
  status: PhysicalTaskStatus,
  amountMinor: number,
  expenseConfirmed = false,
): TaskCommitment => ({ status, committed: sgd(amountMinor), expenseConfirmed });

describe("committedOpenSpend", () => {
  it("holds the estimate of every task that is still open", () => {
    const tasks = [task("DISPATCHED", 600), task("ACCEPTED", 1_000), task("SUBMITTED", 1_000)];
    expect(committedOpenSpend(tasks, "SGD")).toEqual(sgd(2_600));
  });

  it("keeps a completed task's commitment until its expense is confirmed", () => {
    expect(committedOpenSpend([task("COMPLETED", 600)], "SGD")).toEqual(sgd(600));
    expect(committedOpenSpend([task("COMPLETED", 600, true)], "SGD")).toEqual(sgd(0));
  });

  it("releases the commitment of cancelled and expired tasks", () => {
    expect(committedOpenSpend([task("CANCELLED", 600), task("EXPIRED", 1_000)], "SGD")).toEqual(
      sgd(0),
    );
  });
});

describe("ledgerTotals", () => {
  it("subtracts confirmed spend and open commitments from the approved budget", () => {
    const expenses: LedgerExpense[] = [
      { amount: sgd(1_380), status: "CONFIRMED" },
      { amount: sgd(9_999), status: "SUBMITTED" },
      { amount: sgd(9_999), status: "DISPUTED" },
    ];
    const tasks = [
      task("COMPLETED", 600, true),
      task("ACCEPTED", 1_000),
      task("DISPATCHED", 1_000),
    ];
    expect(ledgerTotals(sgd(5_000), expenses, tasks)).toEqual({
      approvedBudget: sgd(5_000),
      confirmedSpend: sgd(1_380),
      committedSpend: sgd(2_000),
      remaining: sgd(1_620),
    });
  });

  it("can go negative rather than hide an overspend", () => {
    const expenses: LedgerExpense[] = [{ amount: sgd(5_200), status: "CONFIRMED" }];
    expect(ledgerTotals(sgd(5_000), expenses, []).remaining).toEqual(sgd(-200));
  });
});
