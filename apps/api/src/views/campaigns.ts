import { toWireMoney, type CampaignView, type PlaybookView, type SpotView } from "@datum/core";
import type { BrandRow, CampaignRow, PlaybookRow, SpotRow } from "@datum/db";

export interface SpotWithScans {
  readonly spot: SpotRow;
  readonly scans: number;
}

export interface CampaignParts {
  readonly campaign: CampaignRow;
  readonly brand: BrandRow;
  readonly playbook: PlaybookRow | null;
  readonly spots: readonly SpotWithScans[];
}

const isoOrNull = (value: Date | null): string | null =>
  value === null ? null : value.toISOString();

export function toPlaybookView(playbook: PlaybookRow, brand: BrandRow): PlaybookView {
  return {
    brandId: playbook.brandId,
    version: playbook.version,
    website: brand.website,
    approvedLogoUrl: playbook.approvedLogoUrl,
    approvedTagline: playbook.approvedTagline,
    defaultPrintFormat: playbook.defaultPrintFormat,
    maxAutonomousPhysicalSpend: toWireMoney({
      amountMinor: playbook.maxAutonomousPhysicalSpendMinor,
      currency: playbook.currency,
    }),
    forbiddenClaims: playbook.forbiddenClaims,
    notes: playbook.notes,
  };
}

function toSpotView({ spot, scans }: SpotWithScans): SpotView {
  return {
    id: spot.id,
    code: spot.code,
    name: spot.name,
    instructions: spot.instructions,
    qrTargetUrl: spot.qrTargetUrl,
    status: spot.status,
    firstPassStatus: spot.firstPassStatus,
    scanCount: scans,
    card: null,
  };
}

export function toCampaignView({ campaign, brand, playbook, spots }: CampaignParts): CampaignView {
  return {
    id: campaign.id,
    status: campaign.status,
    brand: { id: brand.id, name: brand.name, website: brand.website },
    message: campaign.message,
    destinationUrl: campaign.destinationUrl,
    deadline: campaign.deadline.toISOString(),
    budget: toWireMoney({ amountMinor: campaign.budgetMinor, currency: campaign.currency }),
    createdAt: campaign.createdAt.toISOString(),
    approvedAt: isoOrNull(campaign.approvedAt),
    completedAt: isoOrNull(campaign.completedAt),
    playbook: playbook === null ? null : toPlaybookView(playbook, brand),
    proposal: null,
    approval: null,
    spots: spots.map(toSpotView),
  };
}
