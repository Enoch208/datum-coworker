import type { ExpenseView } from "@datum/core";
import { ExpenseStatusChip } from "@/components/status/expense-status-chip";
import { cx } from "@/lib/cx";
import { formatWireMoney } from "@/lib/format";

export function ExpenseRecord({ expense }: { expense: ExpenseView }) {
  return (
    <div
      role="status"
      className={cx(
        "flex flex-col gap-3 rounded-2xl border p-4",
        expense.status === "CONFIRMED" && "border-ok/40 bg-ok/5",
        expense.status === "DISPUTED" && "border-warn/40 bg-warn/5",
        expense.status === "SUBMITTED" && "border-line-strong",
      )}
    >
      <div>
        <ExpenseStatusChip status={expense.status} />
      </div>
      <div className="flex items-center gap-4">
        <img
          src={expense.receiptUrl}
          alt="The receipt you sent"
          className="size-16 shrink-0 rounded-lg border border-line object-cover"
        />
        <div className="min-w-0">
          <p className="font-mono text-2xl text-ink tabular-nums">
            {formatWireMoney(expense.amount)}
          </p>
          <p className="mt-0.5 text-sm break-words text-muted">
            Paid{expense.merchant === null ? "" : ` at ${expense.merchant}`}
          </p>
        </div>
      </div>
      <p className="text-[17px] leading-snug break-words text-ink">{expense.explanation}</p>
    </div>
  );
}
