import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CampaignView, ExpenseView, GoalStateView, TimelineEventView } from "@datum/core";
import { BudgetRaise } from "./budget-raise";
import { DisputeReview } from "./dispute-review";

export const openDisputes = (expenses: readonly ExpenseView[]): ExpenseView[] =>
  expenses.filter(
    (expense) =>
      expense.status === "DISPUTED" &&
      !expenses.some((other) => other.taskId === expense.taskId && other.status !== "DISPUTED"),
  );

const latestStop = (timeline: readonly TimelineEventView[] | null): string | null =>
  timeline?.findLast((event) => event.type === "APPROVAL_REQUESTED")?.summary ?? null;

export function ApprovalNeeded({
  campaign,
  goal,
  timeline,
  onDone,
}: {
  campaign: CampaignView;
  goal: GoalStateView | null;
  timeline: readonly TimelineEventView[] | null;
  onDone: () => void;
}) {
  const disputes = openDisputes(campaign.ledger?.expenses ?? []);
  const decision = goal?.latestDecision ?? null;
  const verdict = decision?.verdict.outcome === "NEEDS_APPROVAL" ? decision.verdict : null;
  const reason = latestStop(timeline);
  const current = campaign.ledger?.approvedBudget ?? campaign.budget;
  return (
    <section
      aria-labelledby="decide-heading"
      className="rounded-3xl border border-warn/40 bg-warn/[0.04] px-5 py-7 sm:px-10 sm:py-9"
    >
      <div className="flex items-center gap-2 text-warn">
        <HugeiconsIcon icon={Alert02Icon} size={20} strokeWidth={1.8} aria-hidden />
        <h2 id="decide-heading" className="text-base font-medium">
          Your decision is needed
        </h2>
      </div>
      {reason !== null && (
        <p className="mt-3 max-w-3xl text-[15px] break-words text-ink">
          {/[.!?]$/.test(reason) ? reason : `${reason}.`}
        </p>
      )}
      <div className="mt-8 flex flex-col gap-12">
        {disputes.length > 0 ? (
          disputes.map((expense) => (
            <DisputeReview key={expense.id} campaign={campaign} expense={expense} onDone={onDone} />
          ))
        ) : (
          <BudgetRaise campaign={campaign} current={current} verdict={verdict} onDone={onDone} />
        )}
      </div>
    </section>
  );
}
