import { finalCampaignStatuses, type CampaignView, type FinalCampaignStatus } from "@datum/core";

export type ApprovalState = "unapproved" | "stale" | "current";

export function approvalState(campaign: CampaignView): ApprovalState {
  const { approval, proposal } = campaign;
  if (approval === null) return "unapproved";
  const matches = proposal !== null && approval.assetVersion === proposal.assetVersion;
  return approval.current && matches ? "current" : "stale";
}

export const isFinal = (campaign: CampaignView): boolean =>
  finalCampaignStatuses.some((status: FinalCampaignStatus) => status === campaign.status);
