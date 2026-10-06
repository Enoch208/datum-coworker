import {
  copyRejection,
  isCopyEditable,
  normalizeCopy,
  type CampaignStatus,
  type CampaignView,
  type PublicCopy,
} from "@datum/core";
import { campaignAssets, type CampaignAssetRow } from "@datum/db";
import { printRejection } from "../cards/check";
import type { ApiDeps } from "../deps";
import { conflict, unprocessable } from "../http/errors";
import type { CampaignParts } from "../views/campaigns";
import { recordAudit } from "./audit";
import { campaignDetail, campaignParts, currentAsset, latestApproval } from "./campaigns";
import { hashOfAsset, publishCards } from "./proposals";
import { lockCampaign, moveStatus } from "./status";

const assertEditable = (status: CampaignStatus): void => {
  if (!isCopyEditable(status)) {
    throw conflict("COPY_LOCKED", `The copy of a ${status} campaign can no longer change`);
  }
};

const requireProposal = (parts: CampaignParts): CampaignAssetRow => {
  if (parts.asset !== null) return parts.asset;
  throw conflict("NO_PROPOSAL", "There is no proposal to edit yet; plan the campaign first");
};

const assertPrintable = (parts: CampaignParts, asset: CampaignAssetRow, copy: PublicCopy) => {
  const forbiddenClaims = parts.playbook?.forbiddenClaims ?? [];
  const rejection =
    copyRejection(copy, forbiddenClaims) ??
    printRejection(copy, {
      brandName: parts.brand.name,
      printFormat: asset.printFormat,
      spots: parts.spots.map(({ spot }) => spot),
    });
  if (rejection !== null) {
    throw unprocessable("COPY_REJECTED", `${rejection.reason}: ${rejection.detail}`);
  }
};

async function saveEditedCopy(
  deps: ApiDeps,
  parts: CampaignParts,
  edited: CampaignAssetRow,
  copy: PublicCopy,
): Promise<CampaignAssetRow> {
  const campaignId = parts.campaign.id;
  return deps.db.transaction(async (tx) => {
    const campaign = await lockCampaign(tx, campaignId);
    assertEditable(campaign.status);
    if ((await currentAsset(tx, campaignId))?.version !== edited.version) {
      throw conflict("CONFLICT", "The proposal changed while you were editing; reload it");
    }
    const [next] = await tx
      .insert(campaignAssets)
      .values({
        campaignId,
        version: edited.version + 1,
        templateVersion: edited.templateVersion,
        headline: copy.headline,
        subcopy: copy.subcopy,
        printFormat: edited.printFormat,
        steps: edited.steps,
        estimatedSpendMinor: edited.estimatedSpendMinor,
        currency: edited.currency,
        assumptions: edited.assumptions,
        customerWarnings: edited.customerWarnings,
        plannedByModel: edited.plannedByModel,
        assetHash: hashOfAsset(parts, copy, edited.printFormat),
        spotsHash: edited.spotsHash,
      })
      .returning();
    if (next === undefined) throw new Error("Inserting the edited proposal returned no row");
    const approval = await latestApproval(tx, campaignId);
    await recordAudit(tx, campaignId, {
      type: "COPY_EDITED",
      payload: {
        fromVersion: edited.version,
        assetVersion: next.version,
        supersededApproval: approval?.assetVersion === edited.version ? approval.version : null,
      },
    });
    if (campaign.status === "APPROVED") {
      await moveStatus(tx, campaignId, "APPROVED", "AWAITING_APPROVAL", { approvedAt: null });
    }
    return next;
  });
}

export async function editCopy(
  deps: ApiDeps,
  campaignId: string,
  requested: PublicCopy,
): Promise<CampaignView> {
  const parts = await campaignParts(deps.db, campaignId);
  const asset = requireProposal(parts);
  assertEditable(parts.campaign.status);
  const copy = normalizeCopy(requested);
  if (copy.headline === asset.headline && copy.subcopy === asset.subcopy) {
    return campaignDetail(deps.db, deps.appBaseUrl, campaignId);
  }
  assertPrintable(parts, asset, copy);
  const next = await saveEditedCopy(deps, parts, asset, copy);
  await publishCards(deps, parts, next);
  return campaignDetail(deps.db, deps.appBaseUrl, campaignId);
}
