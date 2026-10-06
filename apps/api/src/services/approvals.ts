import type { ApproveCampaignRequest, CampaignView } from "@datum/core";
import { approvals, type CampaignAssetRow, type CampaignRow, type Executor } from "@datum/db";
import type { ApiDeps } from "../deps";
import { conflict } from "../http/errors";
import { recordAudit } from "./audit";
import {
  campaignDetail,
  campaignParts,
  campaignPlaybook,
  currentAsset,
  latestApproval,
} from "./campaigns";
import { spotsHash } from "./hashes";
import { spotFingerprints } from "./proposals";
import { lockCampaign, moveStatus } from "./status";

const requireCurrent = async (
  tx: Executor,
  campaignId: string,
  requestedVersion: number,
): Promise<CampaignAssetRow> => {
  const asset = await currentAsset(tx, campaignId);
  if (asset === null) {
    throw conflict("NO_PROPOSAL", "There is no proposal to approve yet; plan the campaign first");
  }
  if (asset.version !== requestedVersion) {
    throw conflict(
      "STALE_PROPOSAL",
      `Proposal version ${String(requestedVersion)} is no longer current; version ${String(asset.version)} is`,
    );
  }
  return asset;
};

const assertApprovable = (campaign: CampaignRow): void => {
  if (campaign.status !== "AWAITING_APPROVAL") {
    throw conflict("INVALID_STATE", `A ${campaign.status} campaign cannot be approved`);
  }
  if (campaign.deadline.getTime() <= Date.now()) {
    throw conflict("DEADLINE_PASSED", "The campaign deadline has passed");
  }
};

async function lockApproval(
  tx: Executor,
  campaign: CampaignRow,
  asset: CampaignAssetRow,
  approvedBy: string,
): Promise<void> {
  const parts = await campaignParts(tx, campaign.id);
  if (spotsHash(spotFingerprints(parts)) !== asset.spotsHash) {
    throw conflict("STALE_PROPOSAL", "The approved spots changed after this proposal was made");
  }
  const playbook = await campaignPlaybook(tx, campaign.brandId, campaign.brandPlaybookVersion);
  if (playbook === null) throw new Error(`Campaign ${campaign.id} has no Brand Playbook`);
  const version = ((await latestApproval(tx, campaign.id))?.version ?? 0) + 1;
  const approvedAt = new Date();
  await tx.insert(approvals).values({
    campaignId: campaign.id,
    version,
    assetVersion: asset.version,
    assetHash: asset.assetHash,
    spotsHash: asset.spotsHash,
    approvedHeadline: asset.headline,
    approvedSubcopy: asset.subcopy,
    budgetMinor: campaign.budgetMinor,
    currency: campaign.currency,
    deadline: campaign.deadline,
    evidencePolicy: playbook.defaultEvidencePolicy,
    approvedBy,
    approvedAt,
  });
  await recordAudit(tx, campaign.id, {
    type: "CAMPAIGN_APPROVED",
    payload: {
      approvalVersion: version,
      assetVersion: asset.version,
      assetHash: asset.assetHash,
      spotsHash: asset.spotsHash,
      approvedBy,
      budget: { amountMinor: campaign.budgetMinor, currency: campaign.currency },
      deadline: campaign.deadline.toISOString(),
    },
  });
  await moveStatus(tx, campaign.id, "AWAITING_APPROVAL", "APPROVED", { approvedAt });
}

export async function approveProposal(
  deps: ApiDeps,
  campaignId: string,
  request: ApproveCampaignRequest,
): Promise<CampaignView> {
  await deps.db.transaction(async (tx) => {
    const campaign = await lockCampaign(tx, campaignId);
    const asset = await requireCurrent(tx, campaignId, request.assetVersion);
    const latest = await latestApproval(tx, campaignId);
    if (campaign.status === "APPROVED" && latest?.assetVersion === asset.version) return;
    assertApprovable(campaign);
    await lockApproval(tx, campaign, asset, request.approvedBy);
  });
  return campaignDetail(deps.db, deps.appBaseUrl, campaignId);
}
