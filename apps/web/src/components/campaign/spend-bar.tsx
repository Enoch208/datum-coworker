import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { compareMoney, fromWireMoney, type WireMoney } from "@datum/core";
import { cx } from "@/lib/cx";
import { formatWireMoney } from "@/lib/format";

export function SpendBar({ estimate, budget }: { estimate: WireMoney; budget: WireMoney }) {
  const spend = fromWireMoney(estimate);
  const cap = fromWireMoney(budget);
  const over = compareMoney(spend, cap) > 0;
  const share = cap.amountMinor > 0 ? Math.min(1, spend.amountMinor / cap.amountMinor) : 1;
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-3xl font-light tracking-tight text-ink tabular-nums">
          {formatWireMoney(estimate)}
        </span>
        <span className="text-sm text-muted">
          estimated, of a <span className="font-mono text-ink">{formatWireMoney(budget)}</span>{" "}
          budget
        </span>
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
        <div
          className={cx("h-full rounded-full", over ? "bg-danger" : "bg-ink")}
          style={{ width: `${String(share * 100)}%` }}
        />
      </div>
      {over && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-danger">
          <HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={1.8} aria-hidden />
          The estimate is above the budget.
        </p>
      )}
    </div>
  );
}
