import { finalCampaignStatuses, type CampaignStatus } from "./contract";

export const campaignTransitions = {
  DRAFT: ["PLANNING", "CANCELLED", "EXPIRED_INCOMPLETE"],
  PLANNING: ["AWAITING_APPROVAL", "CANCELLED", "EXPIRED_INCOMPLETE"],
  AWAITING_APPROVAL: ["APPROVED", "CANCELLED", "EXPIRED_INCOMPLETE"],
  APPROVED: ["EXECUTING", "CANCELLED", "EXPIRED_INCOMPLETE", "FAILED"],
  EXECUTING: ["VERIFYING", "CANCELLED", "EXPIRED_INCOMPLETE", "FAILED"],
  VERIFYING: ["COMPLETED", "REMEDIATING", "EXECUTING", "CANCELLED", "EXPIRED_INCOMPLETE", "FAILED"],
  REMEDIATING: ["EXECUTING", "NEEDS_APPROVAL", "CANCELLED", "EXPIRED_INCOMPLETE", "FAILED"],
  NEEDS_APPROVAL: ["EXECUTING", "CANCELLED", "EXPIRED_INCOMPLETE"],
  COMPLETED: [],
  EXPIRED_INCOMPLETE: [],
  FAILED: [],
  CANCELLED: [],
} as const satisfies Record<CampaignStatus, readonly CampaignStatus[]>;

export class TransitionError extends Error {
  readonly from: CampaignStatus;
  readonly to: CampaignStatus;

  constructor(from: CampaignStatus, to: CampaignStatus) {
    super(`Campaign cannot move from ${from} to ${to}`);
    this.name = "TransitionError";
    this.from = from;
    this.to = to;
  }
}

const finalStatuses: ReadonlySet<CampaignStatus> = new Set(finalCampaignStatuses);

export const isFinalStatus = (status: CampaignStatus): boolean => finalStatuses.has(status);

export const canTransition = (from: CampaignStatus, to: CampaignStatus): boolean => {
  const allowed: readonly CampaignStatus[] = campaignTransitions[from];
  return allowed.includes(to);
};

export const assertTransition = (from: CampaignStatus, to: CampaignStatus): void => {
  if (!canTransition(from, to)) throw new TransitionError(from, to);
};
