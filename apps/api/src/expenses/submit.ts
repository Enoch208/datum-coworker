import { rm } from "node:fs/promises";
import { join } from "node:path";
import { and, eq, ne } from "drizzle-orm";
import type { ExpenseView, Money } from "@datum/core";
import { expenses, physicalTasks, type Executor, type ExpenseRow, type RunnerRow } from "@datum/db";
import type { ApiDeps } from "../deps";
import { conflict } from "../http/errors";
import { runnerTask } from "../runners/tasks";
import { recordAudit } from "../services/audit";
import { acceptImage, assertAcceptableImage, contentHashOf } from "../uploads/image";
import { storeImage } from "../uploads/store";
import { toExpenseView } from "../views/ledger";
import { decideReceipt } from "./decide";
import { assertTakesReceipts, enteredAmount, enteredMerchant, type ExpenseInput } from "./intake";

export interface SubmittedExpense {
  readonly view: ExpenseView;
  readonly created: boolean;
}

interface Receipt {
  readonly contentHash: string;
  readonly amount: Money;
  readonly merchant: string | null;
}

async function priorExpense(db: Executor, taskId: string, receipt: Receipt) {
  const own = await db.select().from(expenses).where(eq(expenses.physicalTaskId, taskId));
  const same = own.find(
    (row) =>
      row.contentHash === receipt.contentHash && row.amountMinor === receipt.amount.amountMinor,
  );
  if (same !== undefined) return same;
  if (own.some((row) => row.status !== "DISPUTED")) {
    throw conflict(
      "EXPENSE_ALREADY_SUBMITTED",
      "This print run already has a receipt waiting or confirmed",
    );
  }
  return null;
}

async function recordReceipt(
  deps: ApiDeps,
  runner: RunnerRow,
  taskId: string,
  receipt: Receipt & { file: string },
): Promise<ExpenseRow | null> {
  return deps.db.transaction(async (tx) => {
    const target = await runnerTask(tx, runner, taskId, true);
    const [row] = await tx
      .insert(expenses)
      .values({
        campaignId: target.task.campaignId,
        physicalTaskId: taskId,
        receiptFile: receipt.file,
        contentHash: receipt.contentHash,
        merchant: receipt.merchant,
        amountMinor: receipt.amount.amountMinor,
        currency: receipt.amount.currency,
        explanation: "Waiting for the receipt check.",
      })
      .onConflictDoNothing()
      .returning();
    if (row === undefined) return null;
    await recordAudit(tx, target.task.campaignId, {
      type: "EXPENSE_SUBMITTED",
      payload: {
        expenseId: row.id,
        taskId,
        amount: receipt.amount,
        merchant: receipt.merchant,
        runnerName: runner.name,
      },
    });
    await tx
      .update(physicalTasks)
      .set({ status: "SUBMITTED", updatedAt: new Date() })
      .where(and(eq(physicalTasks.id, taskId), eq(physicalTasks.status, "ACCEPTED")));
    return row;
  });
}

async function liveExpense(db: Executor, taskId: string): Promise<ExpenseRow | undefined> {
  const [row] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.physicalTaskId, taskId), ne(expenses.status, "DISPUTED")));
  return row;
}

export async function submitExpense(
  deps: ApiDeps,
  runner: RunnerRow,
  taskId: string,
  input: ExpenseInput,
): Promise<SubmittedExpense> {
  const target = await runnerTask(deps.db, runner, taskId);
  assertTakesReceipts(target);
  const amount = enteredAmount(input.amountText, target.task.currency);
  const merchant = enteredMerchant(input.merchantText);
  assertAcceptableImage(input.receipt, "receipt");
  const receipt = { contentHash: contentHashOf(input.receipt), amount, merchant };
  const prior = await priorExpense(deps.db, taskId, receipt);
  if (prior !== null) return { view: toExpenseView(prior, deps.appBaseUrl), created: false };
  const image = await acceptImage(input.receipt, "receipt");
  const file = await storeImage(deps.evidenceDir, image.jpeg);
  const row = await recordReceipt(deps, runner, taskId, { ...receipt, file });
  if (row === null) {
    await rm(join(deps.evidenceDir, file), { force: true });
    const winner = await liveExpense(deps.db, taskId);
    if (winner?.contentHash !== receipt.contentHash) {
      throw conflict("EXPENSE_ALREADY_SUBMITTED", "This print run already has a receipt");
    }
    return { view: toExpenseView(winner, deps.appBaseUrl), created: false };
  }
  const decided = await decideReceipt(deps.db, deps.receiptReader, row, image.jpeg);
  return { view: toExpenseView(decided, deps.appBaseUrl), created: true };
}
