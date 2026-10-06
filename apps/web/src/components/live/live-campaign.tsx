import type { CampaignView, GoalStateView, TimelineEventView } from "@datum/core";
import { LockedPanel } from "@/components/approval/locked-panel";
import { Timeline } from "@/components/campaign/timeline";
import { TaskList } from "@/components/execution/task-list";
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
}: {
  campaign: CampaignView;
  fetchedAt: number | null;
  stale: boolean;
  timeline: Resource<TimelineEventView[]>;
  goal: Resource<GoalStateView | null>;
}) {
  const interventions = timeline.data === null ? null : countInterventions(timeline.data);
  return (
    <div className="flex flex-col gap-10 sm:gap-14">
      <StatusHero
        campaign={campaign}
        goal={goal.data}
        interventions={interventions}
        fetchedAt={fetchedAt}
        stale={stale}
      />
      <div className="grid items-start gap-14 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <SpotBoard campaign={campaign} />
        {campaign.approval !== null && (
          <aside className="lg:sticky lg:top-24">
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
