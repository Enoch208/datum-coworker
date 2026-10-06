import { fromWireMoney, type LedgerView, type TaskSummaryView, type WireMoney } from "@datum/core";
import { SectionHeading } from "@/components/campaign/section-heading";
import { ByRules } from "@/components/status/provenance";
import { cx } from "@/lib/cx";
import { formatWireMoney } from "@/lib/format";
import { ExpenseList } from "./expense-list";

function Figure({ label, money, strong }: { label: string; money: WireMoney; strong?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-t border-line pt-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={cx(
          "font-mono text-lg tabular-nums",
          strong === true ? "text-accent" : "text-ink",
        )}
      >
        {formatWireMoney(money)}
      </dd>
    </div>
  );
}

function share(part: WireMoney, whole: WireMoney): string {
  const total = fromWireMoney(whole).amountMinor;
  const value = fromWireMoney(part).amountMinor;
  return `${String(total > 0 ? Math.min(100, (value / total) * 100) : 0)}%`;
}

function LedgerBar({ ledger }: { ledger: LedgerView }) {
  return (
    <div className="mt-6">
      <div className="flex h-2 overflow-hidden rounded-full bg-line" aria-hidden>
        <div
          className="h-full bg-ink"
          style={{ width: share(ledger.confirmedSpend, ledger.approvedBudget) }}
        />
        <div
          className="h-full bg-muted/50"
          style={{ width: share(ledger.committedSpend, ledger.approvedBudget) }}
        />
      </div>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-ink" aria-hidden />
          Confirmed: a checked receipt backs it
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-muted/50" aria-hidden />
          Committed: held for open tasks
        </span>
      </p>
    </div>
  );
}

export function LedgerPanel({
  ledger,
  tasks,
}: {
  ledger: LedgerView | null;
  tasks: readonly TaskSummaryView[];
}) {
  return (
    <section aria-labelledby="spend-heading">
      <SectionHeading id="spend-heading" title="Spend">
        <ByRules label="Ledger kept by rules" />
      </SectionHeading>
      <p className="mt-2 max-w-2xl text-[15px] font-light text-muted">
        Physical costs from real receipts. Money counts as spent only after Datum confirms the
        receipt.
      </p>
      {ledger === null ? (
        <p className="mt-6 text-sm text-muted">No spend has been recorded yet.</p>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <Figure label="Approved budget" money={ledger.approvedBudget} />
            <Figure label="Confirmed" money={ledger.confirmedSpend} />
            <Figure label="Committed" money={ledger.committedSpend} />
            <Figure label="Remaining" money={ledger.remaining} strong />
          </dl>
          <LedgerBar ledger={ledger} />
          <ExpenseList expenses={ledger.expenses} tasks={tasks} />
        </>
      )}
    </section>
  );
}
