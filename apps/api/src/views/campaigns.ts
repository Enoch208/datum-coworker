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
  EvidenceRow,
  ExpenseRow,
  PlaybookRow,
  SpotRow,
} from "@datum/db";
import { cardAssetKey, cardAssetUrl } from "../cards/store";
import type { TaskWithSpot } from "../services/execution-reads";
import { deciding, toEvidenceView } from "./evidence";
import { toLedgerView, toTaskSummaryView } from "./ledger";
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
  readonly tasks: readonly TaskWithSpot[];
  readonly expenses: readonly ExpenseRow[];
  readonly evidence: readonly EvidenceRow[];
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

function latestEvidence(
  spot: SpotRow,
  rows: readonly EvidenceRow[],
  appBaseUrl: string,
): SpotView["latestEvidence"] {
  const row = deciding(rows.filter((candidate) => candidate.spotId === spot.id));
  return row === null ? null : toEvidenceView(row, spot.code, appBaseUrl);
}

function toSpotView(
  { spot, scans }: SpotWithScans,
  parts: CampaignParts,
  appBaseUrl: string,
): SpotView {
  const { asset } = parts;
  return {
    id: spot.id,
    code: spot.code,
    name: spot.name,
    instructions: spot.instructions,
    qrTargetUrl: spot.qrTargetUrl,
    status: spot.status,
    firstPassStatus: spot.firstPassStatus,
    inducedMiss: spot.inducedMiss,
    scanCount: scans,
    card: asset === null ? null : cardView(appBaseUrl, asset, spot.code),
    latestEvidence: latestEvidence(spot, parts.evidence, appBaseUrl),
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
  const { campaign, brand, playbook, spots, asset, approval, tasks, expenses } = parts;
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
    ownerKeyRegistered: campaign.ownerPublicKey !== null,
    playbook: playbook === null ? null : toPlaybookView(playbook, brand),
    proposal: proposalOf(parts),
    approval: approval === null || asset === null ? null : toApprovalView(approval, asset.version),
    spots: spots.map((spot) => toSpotView(spot, parts, appBaseUrl)),
    tasks: tasks.map(toTaskSummaryView),
    ledger: approval === null ? null : toLedgerView(approval, tasks, expenses, appBaseUrl),
  };
}
