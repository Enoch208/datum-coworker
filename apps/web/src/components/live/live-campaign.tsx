import type { CampaignView, GoalStateView, TimelineEventView } from "@datum/core";
import { LockedPanel } from "@/components/approval/locked-panel";
import { Timeline } from "@/components/campaign/timeline";
import { TaskList } from "@/components/execution/task-list";
import { ApprovalNeeded } from "@/components/intervention/approval-needed";
import { WhyPanel } from "@/components/why/why-panel";
import { countInterventions } from "@/lib/campaign-phase";
import type { Resource } from "@/lib/use-resource";
import { BudgetPanel } from "./budget-panel";
import { SpotBoard } from "./spot-board";
import { StatusHero } from "./status-hero";

export function LiveCampaign({
  campaign,
  fetchedAt,
  stale,
  timeline,
  goal,
  reload,
}: {
  campaign: CampaignView;
  fetchedAt: number | null;
  stale: boolean;
  timeline: Resource<TimelineEventView[]>;
  goal: Resource<GoalStateView | null>;
  reload: () => void;
}) {
  const interventions = timeline.data === null ? null : countInterventions(timeline.data);
  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <StatusHero
        campaign={campaign}
        goal={goal.data}
        interventions={interventions}
        fetchedAt={fetchedAt}
        stale={stale}
      />
      {campaign.status === "NEEDS_APPROVAL" && (
        <ApprovalNeeded
          campaign={campaign}
          goal={goal.data}
          timeline={timeline.data}
          onDone={reload}
        />
      )}
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <SpotBoard campaign={campaign} />
        {campaign.approval !== null && (
          <aside className="xl:sticky xl:top-8">
            <LockedPanel campaign={campaign} approval={campaign.approval} />
          </aside>
        )}
      </div>
      <WhyPanel goal={goal} />
      <BudgetPanel ledger={campaign.ledger} tasks={campaign.tasks} />
      <div className="grid items-start gap-14 lg:grid-cols-2 lg:gap-12">
        <TaskList tasks={campaign.tasks} />
        <Timeline resource={timeline} recent={14} />
      </div>
    </div>
  );
}
