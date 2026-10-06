import type { ApprovalLock, Currency, Money } from "@datum/core";
import type { ApprovalRow, AuditEventRow, BrandRow, CampaignRow, SpotRow } from "@datum/db";

const isoOrNull = (value: Date | null): string | null =>
  value === null ? null : value.toISOString();

const money = (amountMinor: number, currency: Currency): Money => ({ amountMinor, currency });

export function toCampaignView(campaign: CampaignRow, brand: BrandRow) {
  return {
    id: campaign.id,
    brand: { id: brand.id, name: brand.name, website: brand.website },
    brandPlaybookVersion: campaign.brandPlaybookVersion,
    message: campaign.message,
    destinationUrl: campaign.destinationUrl,
    status: campaign.status,
    deadline: campaign.deadline.toISOString(),
    budget: money(campaign.budgetMinor, campaign.currency),
    approvedAt: isoOrNull(campaign.approvedAt),
    completedAt: isoOrNull(campaign.completedAt),
    createdAt: campaign.createdAt.toISOString(),
  };
}

export function toSpotView(spot: SpotRow, scanCount: number) {
  return {
    id: spot.id,
    code: spot.code,
    name: spot.name,
    instructions: spot.instructions,
    qrTargetUrl: spot.qrTargetUrl,
    assetUrl: spot.assetUrl,
    status: spot.status,
    firstPassStatus: spot.firstPassStatus,
    scanCount,
  };
}

export function toApprovalLock(approval: ApprovalRow): ApprovalLock {
  return {
    campaignId: approval.campaignId,
    assetVersion: approval.assetVersion,
    assetHash: approval.assetHash,
    spotsHash: approval.spotsHash,
    budget: money(approval.budgetMinor, approval.currency),
    deadline: approval.deadline.toISOString(),
    evidencePolicy: approval.evidencePolicy,
    approvedBy: approval.approvedBy,
    approvedAt: approval.approvedAt.toISOString(),
  };
}

export function toAuditEventView(event: AuditEventRow) {
  return {
    id: event.id,
    type: event.type,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  };
}
