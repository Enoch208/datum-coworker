import type { GoalStateView, UnresolvedRequirementView } from "@datum/core";
import type { ReactNode } from "react";
import { formatMinutes, formatSgtMoment, formatWireMoney } from "@/lib/format";

export function UnresolvedList({ items }: { items: readonly UnresolvedRequirementView[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.spotCode} className="flex gap-3 text-sm">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-danger/40 font-mono text-xs text-danger">
            {item.spotCode}
          </span>
          <span className="min-w-0 pt-0.5 text-ink">
            {item.reason}
            <span className="ml-2 font-mono text-[11px] text-muted">{item.reasonCode}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-t border-line pt-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-base text-ink tabular-nums">{children}</dd>
    </div>
  );
}

export function GoalPosition({ goal }: { goal: GoalStateView }) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm font-medium text-ink">
          Unresolved{" "}
          <span className="font-mono text-muted tabular-nums">{goal.unresolved.length}</span>
        </p>
        <div className="mt-3">
          {goal.unresolved.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing unresolved. Every approved spot is verified.
            </p>
          ) : (
            <UnresolvedList items={goal.unresolved} />
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Figure label="Remaining budget">{formatWireMoney(goal.remainingBudget)}</Figure>
        <Figure label="Confirmed spend">{formatWireMoney(goal.confirmedSpend)}</Figure>
        <Figure label="Committed">{formatWireMoney(goal.committedSpend)}</Figure>
        <Figure label="Minutes to deadline">{goal.minutesToDeadline}</Figure>
      </dl>
      <p className="text-xs text-muted">
        Read from the server at {formatSgtMoment(goal.evaluatedAt)} SGT against an approved budget
        of {formatWireMoney(goal.approvedBudget)}. The time left (
        {formatMinutes(goal.minutesToDeadline)}) is the server&apos;s figure, not a countdown in
        your browser.
      </p>
    </div>
  );
}
