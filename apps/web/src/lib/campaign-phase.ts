import type { CampaignStatus, CampaignView, TimelineEventView } from "@datum/core";

const runningStatuses: readonly CampaignStatus[] = [
  "EXECUTING",
  "VERIFYING",
  "REMEDIATING",
  "NEEDS_APPROVAL",
];

const endedStatuses: readonly CampaignStatus[] = ["COMPLETED", "EXPIRED_INCOMPLETE"];

export const isRunning = (status: CampaignStatus): boolean => runningStatuses.includes(status);

export const hasReceipt = (status: CampaignStatus): boolean => endedStatuses.includes(status);

export const hasStarted = (campaign: CampaignView): boolean =>
  isRunning(campaign.status) || hasReceipt(campaign.status) || campaign.tasks.length > 0;

export const pollsWhile = (status: CampaignStatus): boolean =>
  status === "PLANNING" || isRunning(status);

export const countInterventions = (timeline: readonly TimelineEventView[]): number =>
  timeline.filter((event) => event.type === "INTERVENTION_RECORDED").length;
