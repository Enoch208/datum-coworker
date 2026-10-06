import type { RemediationDecisionView } from "@datum/core";
import type { ReactNode } from "react";
import { AiProposed, ByRules } from "@/components/status/provenance";
import { formatMinutes, formatSgtMoment, formatWireMoney } from "@/lib/format";
import { DispatchBlock, ProposalBlock } from "./decision-parts";
import { UnresolvedList } from "./goal-position";
import { VerdictBlock } from "./verdict-block";

function Step({
  index,
  title,
  badge,
  children,
}: {
  index: number;
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="group relative grid grid-cols-[2rem_minmax(0,1fr)] gap-4 pb-9 last:pb-0">
      <span
        aria-hidden
        className="absolute top-9 bottom-1 left-[0.96875rem] w-px bg-line group-last:hidden"
      />
      <span className="relative flex size-8 items-center justify-center rounded-full border border-line-strong bg-canvas font-mono text-xs text-ink">
        {index}
      </span>
      <div className="min-w-0 pt-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h4 className="text-base font-medium text-ink">{title}</h4>
          {badge}
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </li>
  );
}

function Gaps({ gaps }: { gaps: RemediationDecisionView["gaps"] }) {
  return (
    <div className="flex flex-col gap-4">
      <UnresolvedList items={gaps.missingSpots} />
      <p className="font-mono text-xs text-muted tabular-nums">
        {formatWireMoney(gaps.remainingBudget)} left · {formatMinutes(gaps.minutesToDeadline)} to
        the deadline · {gaps.openTasks.length} open {gaps.openTasks.length === 1 ? "task" : "tasks"}
      </p>
    </div>
  );
}

function Fallback({ used }: { used: boolean }) {
  return (
    <p className="text-[15px] text-ink">
      {used
        ? "Yes. The model's plan was not usable, so the rules applied Datum's standard recovery: one new placement for each unresolved spot."
        : "No. The rules judged the model's own proposal; nothing was substituted."}
    </p>
  );
}

export function DecisionTrail({ decision }: { decision: RemediationDecisionView }) {
  const { planner } = decision;
  return (
    <div>
      <p className="font-mono text-xs text-muted tabular-nums">
        Round {decision.round} · decided {formatSgtMoment(decision.decidedAt)} SGT
      </p>
      <ol className="mt-6">
        <Step index={1} title="Gaps the rules found" badge={<ByRules label="Evaluated by rules" />}>
          <Gaps gaps={decision.gaps} />
        </Step>
        <Step
          index={2}
          title="What the model proposed"
          badge={planner.model === null ? undefined : <AiProposed model={planner.model} />}
        >
          <ProposalBlock planner={planner} />
        </Step>
        <Step index={3} title="What the rules decided" badge={<ByRules label="Decided by rules" />}>
          <VerdictBlock verdict={decision.verdict} />
        </Step>
        <Step index={4} title="What was dispatched">
          <DispatchBlock decision={decision} />
        </Step>
        <Step index={5} title="Fallback used">
          <Fallback used={decision.fallbackUsed} />
        </Step>
      </ol>
    </div>
  );
}
