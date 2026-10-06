import {
  toWireMoney,
  type CampaignView,
  type PlaybookView,
  type ProposalView,
  type SpotCardView,
  type SpotView,
} from "@datum/core";
import type {
  ApprovalRow,
  BrandRow,
  CampaignAssetRow,
  CampaignRow,
  PlaybookRow,
  SpotRow,
} from "@datum/db";
import { cardAssetKey, cardAssetUrl } from "../cards/store";
import { toApprovalView, toProposalView } from "./proposal";

export interface SpotWithScans {
  readonly spot: SpotRow;
  readonly scans: number;
}

export interface CampaignParts {
  readonly campaign: CampaignRow;
  readonly brand: BrandRow;
  readonly playbook: PlaybookRow | null;
  readonly spots: readonly SpotWithScans[];
  readonly asset: CampaignAssetRow | null;
  readonly approval: ApprovalRow | null;
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

function cardView(appBaseUrl: string, asset: CampaignAssetRow, spotCode: string): SpotCardView {
  const url = (file: "png" | "pdf") =>
    cardAssetUrl(appBaseUrl, cardAssetKey(asset.campaignId, asset.version, spotCode, file));
  return { pngUrl: url("png"), pdfUrl: url("pdf") };
}

function toSpotView(
  { spot, scans }: SpotWithScans,
  asset: CampaignAssetRow | null,
  appBaseUrl: string,
): SpotView {
  return {
    id: spot.id,
    code: spot.code,
    name: spot.name,
    instructions: spot.instructions,
    qrTargetUrl: spot.qrTargetUrl,
    status: spot.status,
    firstPassStatus: spot.firstPassStatus,
    scanCount: scans,
    card: asset === null ? null : cardView(appBaseUrl, asset, spot.code),
  };
}

function proposalOf({ asset, playbook, campaign }: CampaignParts): ProposalView | null {
  if (asset === null) return null;
  if (playbook === null) {
    throw new Error(`Campaign ${campaign.id} has a proposal but no Brand Playbook`);
  }
  return toProposalView(asset, playbook.defaultEvidencePolicy);
}

export function toCampaignView(parts: CampaignParts, appBaseUrl: string): CampaignView {
  const { campaign, brand, playbook, spots, asset, approval } = parts;
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
    proposal: proposalOf(parts),
    approval: approval === null || asset === null ? null : toApprovalView(approval, asset.version),
    spots: spots.map((spot) => toSpotView(spot, asset, appBaseUrl)),
  };
}
