import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { LedgerView, TaskSummaryView, WireMoney } from "@datum/core";
import { SectionHeading } from "@/components/campaign/section-heading";
import { ExpenseList } from "@/components/execution/expense-list";
import { ByRules } from "@/components/status/provenance";
import { cx } from "@/lib/cx";
import { formatWireMoney, toMoney } from "@/lib/format";
import { FeeList } from "./fee-list";

const share = (part: WireMoney, whole: WireMoney): number => {
  const total = toMoney(whole).amountMinor;
  return total > 0 ? Math.max(0, Math.min(1, toMoney(part).amountMinor / total)) : 0;
};

const percent = (value: number): string => `${String(value * 100)}%`;

function Figure({ label, money, swatch }: { label: string; money: WireMoney; swatch: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-t border-line pt-4">
      <dt className="flex items-center gap-1.5 text-xs text-muted">
        <span aria-hidden className={cx("size-2 rounded-full", swatch)} />
        {label}
      </dt>
      <dd className="font-mono text-lg text-ink tabular-nums">{formatWireMoney(money)}</dd>
    </div>
  );
}

function BudgetBar({ ledger }: { ledger: LedgerView }) {
  const confirmed = share(ledger.confirmedSpend, ledger.approvedBudget);
  const committed = Math.min(1 - confirmed, share(ledger.committedSpend, ledger.approvedBudget));
  return (
    <div className="mt-6 flex h-2.5 overflow-hidden rounded-full bg-line" aria-hidden>
      <div className="h-full bg-ink" style={{ width: percent(confirmed) }} />
      <div className="h-full bg-muted/45" style={{ width: percent(committed) }} />
    </div>
  );
}

function LedgerBody({ ledger, tasks }: { ledger: LedgerView; tasks: readonly TaskSummaryView[] }) {
  const over = toMoney(ledger.remaining).amountMinor < 0;
  return (
    <>
      <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={cx(
            "font-mono text-4xl font-light tracking-tight tabular-nums",
            over ? "text-danger" : "text-accent",
          )}
        >
          {formatWireMoney(ledger.remaining)}
        </span>
        <span className="text-sm text-muted">
          left of{" "}
          <span className="font-mono text-ink">{formatWireMoney(ledger.approvedBudget)}</span>{" "}
          approved
        </span>
      </p>
      {over && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-danger">
          <HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={1.8} aria-hidden />
          Spend is above the approved budget.
        </p>
      )}
      <BudgetBar ledger={ledger} />
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        <Figure label="Approved" money={ledger.approvedBudget} swatch="bg-line-strong" />
        <Figure label="Confirmed" money={ledger.confirmedSpend} swatch="bg-ink" />
        <Figure label="Committed" money={ledger.committedSpend} swatch="bg-muted/45" />
        <Figure label="Remaining" money={ledger.remaining} swatch="bg-accent" />
      </dl>
      <p className="mt-4 text-xs text-muted">
        Confirmed: backed by a checked receipt or an agreed fee. Committed: held for work that is
        still open.
      </p>
      <div className="mt-10 grid items-start gap-10 lg:grid-cols-2 lg:gap-12">
        <div>
          <h3 className="text-base font-medium text-ink">Print receipts</h3>
          <ExpenseList expenses={ledger.expenses} tasks={tasks} />
        </div>
        <div>
          <h3 className="text-base font-medium text-ink">Agreed runner fees</h3>
          <FeeList fees={ledger.agreedFees ?? []} />
        </div>
      </div>
    </>
  );
}

export function BudgetPanel({
  ledger,
  tasks,
}: {
  ledger: LedgerView | null;
  tasks: readonly TaskSummaryView[];
}) {
  return (
    <section aria-labelledby="budget-heading">
      <SectionHeading id="budget-heading" title="Budget">
        <ByRules label="Ledger kept by rules" />
      </SectionHeading>
      <p className="mt-2 max-w-2xl text-[15px] font-light text-muted">
        Physical costs only. Money counts as spent when a receipt is checked or a runner&apos;s
        agreed fee is owed, never from an estimate.
      </p>
      {ledger === null ? (
        <p className="mt-6 text-sm text-muted">No spend has been recorded yet.</p>
      ) : (
        <LedgerBody ledger={ledger} tasks={tasks} />
      )}
    </section>
  );
}
