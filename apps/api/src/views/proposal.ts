import {
  isApprovalCurrent,
  toWireMoney,
  type ApprovalLock,
  type ApprovalView,
  type EstimatedPlanStep,
  type EvidencePolicy,
  type PlanStep,
  type ProposalView,
} from "@datum/core";
import type { ApprovalRow, CampaignAssetRow } from "@datum/db";

const toPlanStep = (step: EstimatedPlanStep): PlanStep =>
  step.type === "PRINT_AND_COLLECT"
    ? { type: step.type, quantity: step.quantity, estimatedCost: toWireMoney(step.estimatedCost) }
    : { type: step.type, spotCode: step.spotCode, estimatedCost: toWireMoney(step.estimatedCost) };

export function toProposalView(
  asset: CampaignAssetRow,
  evidencePolicy: EvidencePolicy,
): ProposalView {
  return {
    assetVersion: asset.version,
    assetHash: asset.assetHash,
    copy: { headline: asset.headline, subcopy: asset.subcopy },
    printFormat: asset.printFormat,
    steps: asset.steps.map(toPlanStep),
    estimatedSpend: toWireMoney({
      amountMinor: asset.estimatedSpendMinor,
      currency: asset.currency,
    }),
    evidencePolicy,
    assumptions: asset.assumptions,
    customerWarnings: asset.customerWarnings,
    plannedBy: { model: asset.plannedByModel },
    createdAt: asset.createdAt.toISOString(),
  };
}

export function toApprovalLock(approval: ApprovalRow): ApprovalLock {
  return {
    campaignId: approval.campaignId,
    assetVersion: approval.assetVersion,
    assetHash: approval.assetHash,
    spotsHash: approval.spotsHash,
    approvedCopy: { headline: approval.approvedHeadline, subcopy: approval.approvedSubcopy },
    budget: { amountMinor: approval.budgetMinor, currency: approval.currency },
    deadline: approval.deadline.toISOString(),
    evidencePolicy: approval.evidencePolicy,
    approvedBy: approval.approvedBy,
    approvedAt: approval.approvedAt.toISOString(),
  };
}

export function toApprovalView(approval: ApprovalRow, currentAssetVersion: number): ApprovalView {
  const lock = toApprovalLock(approval);
  return {
    version: approval.version,
    assetVersion: lock.assetVersion,
    assetHash: lock.assetHash,
    spotsHash: lock.spotsHash,
    copy: lock.approvedCopy,
    budget: toWireMoney(lock.budget),
    deadline: lock.deadline,
    evidencePolicy: lock.evidencePolicy,
    approvedBy: lock.approvedBy,
    approvedAt: lock.approvedAt,
    current: isApprovalCurrent(lock, currentAssetVersion),
  };
}
