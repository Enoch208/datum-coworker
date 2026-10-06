import type { AgreedFeeView } from "@datum/core";
import { ExpenseStatusChip } from "@/components/status/expense-status-chip";
import { formatSgtMoment, formatWireMoney } from "@/lib/format";

function FeeRow({ fee }: { fee: AgreedFeeView }) {
  return (
    <li className="flex gap-4 py-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line-strong font-mono text-base">
        {fee.spotCode}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-base text-ink tabular-nums">
            {formatWireMoney(fee.amount)}
          </span>
          <ExpenseStatusChip status={fee.status} />
        </div>
        <p className="mt-1 text-sm break-words text-muted">
          Placement at Spot {fee.spotCode} · attempt {fee.attempt}
          {fee.merchant.length > 0 ? ` · ${fee.merchant}` : ""}
        </p>
        <p className="mt-1 text-sm break-words text-ink">{fee.explanation}</p>
        <p className="mt-1 font-mono text-xs text-muted tabular-nums">
          Owed {formatSgtMoment(fee.recordedAt)} SGT
        </p>
      </div>
    </li>
  );
}

export function FeeList({ fees }: { fees: readonly AgreedFeeView[] }) {
  if (fees.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted">
        No runner fee is owed yet. A fee is owed for every completed placement attempt.
      </p>
    );
  }
  return (
    <ul className="mt-4 divide-y divide-line border-y border-line">
      {fees.map((fee) => (
        <FeeRow key={fee.id} fee={fee} />
      ))}
    </ul>
  );
}
