import { eq } from "drizzle-orm";
import { decideExpense, type ReceiptCheck } from "@datum/core";
import { expenses, type Db, type ExpenseRow } from "@datum/db";
import { ReceiptReaderError, type ReceiptReader } from "../receipts/reader";
import { recordAudit } from "../services/audit";

interface Checked {
  readonly check: ReceiptCheck;
  readonly ocr: Record<string, unknown>;
}

async function checkReceipt(reader: ReceiptReader | null, jpeg: Buffer): Promise<Checked> {
  if (reader === null) return { check: { kind: "NO_READER" }, ocr: { reader: null } };
  try {
    const reply = await reader.read(jpeg);
    return {
      check: { kind: "READ", reading: reply.reading },
      ocr: { model: reply.model, reading: reply.reading },
    };
  } catch (error) {
    if (!(error instanceof ReceiptReaderError)) throw error;
    return {
      check: { kind: "READER_FAILED", reason: error.code },
      ocr: { failure: { code: error.code, message: error.message } },
    };
  }
}

export async function decideReceipt(
  db: Db,
  reader: ReceiptReader | null,
  expense: ExpenseRow,
  jpeg: Buffer,
): Promise<ExpenseRow> {
  const { check, ocr } = await checkReceipt(reader, jpeg);
  const amount = { amountMinor: expense.amountMinor, currency: expense.currency };
  const decision = decideExpense(amount, check);
  return db.transaction(async (tx) => {
    const [decided] = await tx
      .update(expenses)
      .set({
        status: decision.status,
        explanation: decision.explanation,
        ocr,
        decidedAt: decision.status === "SUBMITTED" ? null : new Date(),
      })
      .where(eq(expenses.id, expense.id))
      .returning();
    if (decided === undefined) throw new Error(`Expense ${expense.id} vanished before its check`);
    if (decision.status === "SUBMITTED") return decided;
    await recordAudit(tx, expense.campaignId, {
      type: decision.status === "CONFIRMED" ? "EXPENSE_CONFIRMED" : "EXPENSE_DISPUTED",
      payload: {
        expenseId: expense.id,
        taskId: expense.physicalTaskId,
        amount,
        explanation: decision.explanation,
      },
    });
    return decided;
  });
}
