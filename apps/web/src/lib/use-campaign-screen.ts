import type { CampaignView, GoalStateView, TimelineEventView } from "@datum/core";
import { useCallback } from "react";
import { getCampaign, getGoal, getTimeline } from "./api-client";
import { hasStarted, pollsWhile } from "./campaign-phase";
import { usePoll, useResource, type Resource } from "./use-resource";

export interface CampaignScreen {
  readonly campaign: Resource<CampaignView>;
  readonly timeline: Resource<TimelineEventView[]>;
  readonly goal: Resource<GoalStateView | null>;
  readonly reload: () => void;
}

const runningPollMs = 5000;
const planningPollMs = 3000;

export function useCampaignScreen(campaignId: string): CampaignScreen {
  const loadCampaign = useCallback(
    (signal: AbortSignal) => getCampaign(campaignId, signal),
    [campaignId],
  );
  const loadTimeline = useCallback(
    (signal: AbortSignal) => getTimeline(campaignId, signal),
    [campaignId],
  );
  const campaign = useResource(`campaign:${campaignId}`, loadCampaign);
  const timeline = useResource(`timeline:${campaignId}`, loadTimeline);
  const started = campaign.data !== null && hasStarted(campaign.data);
  const loadGoal = useCallback(
    (signal: AbortSignal) =>
      started ? getGoal(campaignId, signal) : Promise.resolve<GoalStateView | null>(null),
    [campaignId, started],
  );
  const goal = useResource(`goal:${campaignId}:${String(started)}`, loadGoal);
  const { reload: reloadCampaign } = campaign;
  const { reload: reloadTimeline } = timeline;
  const { reload: reloadGoal } = goal;
  const reload = useCallback(() => {
    reloadCampaign();
    reloadTimeline();
    reloadGoal();
  }, [reloadCampaign, reloadTimeline, reloadGoal]);
  const status = campaign.data?.status;
  const polling = status !== undefined && pollsWhile(status);
  usePoll(
    polling,
    status === "PLANNING" ? planningPollMs : runningPollMs,
    !campaign.pending,
    reload,
  );
  return { campaign, timeline, goal, reload };
}
