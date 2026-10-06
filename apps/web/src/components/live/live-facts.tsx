import { minutesUntil, type CampaignView, type GoalStateView } from "@datum/core";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { formatMinutes, formatSgtClock, formatWireMoney, sgtDayTime } from "@/lib/format";

function Fact({
  label,
  value,
  note,
  strong,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-t border-line pt-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={cx(
          "font-mono text-lg tabular-nums text-ink sm:text-2xl",
          strong === true ? "font-normal" : "font-light",
        )}
      >
        {value}
      </dd>
      {note !== undefined && <dd className="text-xs text-muted">{note}</dd>}
    </div>
  );
}

function TimeFact({ campaign, goal }: { campaign: CampaignView; goal: GoalStateView | null }) {
  if (campaign.completedAt !== null) {
    const early = minutesUntil(campaign.completedAt, campaign.deadline);
    return (
      <Fact
        label="Completed"
        value={sgtDayTime(campaign.completedAt)}
        note={`SGT · ${formatMinutes(early)} before the deadline`}
      />
    );
  }
  if (campaign.status === "EXPIRED_INCOMPLETE") {
    return <Fact label="Time left" value="None" note="The deadline has passed" />;
  }
  if (goal === null) return <Fact label="Time left" value="…" note="Reading the goal state" />;
  return (
    <Fact
      label="Time left"
      value={formatMinutes(goal.minutesToDeadline)}
      note={`as of ${formatSgtClock(goal.evaluatedAt)}`}
    />
  );
}

export function LiveFacts({
  campaign,
  goal,
  interventions,
}: {
  campaign: CampaignView;
  goal: GoalStateView | null;
  interventions: number | null;
}) {
  const { ledger } = campaign;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-6">
      <Fact label="Deadline" value={sgtDayTime(campaign.deadline)} note="SGT" />
      <TimeFact campaign={campaign} goal={goal} />
      <Fact
        label="Budget left"
        value={ledger === null ? "…" : formatWireMoney(ledger.remaining)}
        note={ledger === null ? undefined : `of ${formatWireMoney(ledger.approvedBudget)} approved`}
      />
      <Fact
        label="Manual interventions after approval"
        value={interventions === null ? "…" : String(interventions)}
        note="Counted from the record"
        strong={interventions === 0}
      />
    </dl>
  );
}
