import { eq } from "drizzle-orm";
import { compareMoney, type PrintFormat, type PublicCopy, type SpotFingerprint } from "@datum/core";
import {
  campaignAssets,
  campaigns,
  type CampaignAssetRow,
  type Db,
  type Executor,
} from "@datum/db";
import { cardTemplateVersion } from "../cards/template";
import type { CampaignServiceDeps } from "../deps";
import type { PlannedProposal } from "../planner/pipeline";
import type { CampaignParts } from "../views/campaigns";
import { recordAudit } from "./audit";
import { renderAssetCards } from "./cards";
import { currentAsset } from "./campaigns";
import { assetHash, spotsHash } from "./hashes";
import { saveDraftPlaybook, type PlaybookChoice } from "./playbooks";
import { lockCampaign, moveStatus } from "./status";

export const spotFingerprints = (parts: CampaignParts): SpotFingerprint[] =>
  parts.spots.map(({ spot }) => ({
    code: spot.code,
    name: spot.name,
    instructions: spot.instructions,
    qrTargetUrl: spot.qrTargetUrl,
  }));

export const hashOfAsset = (parts: CampaignParts, copy: PublicCopy, printFormat: PrintFormat) =>
  assetHash({
    templateVersion: cardTemplateVersion,
    brandName: parts.brand.name,
    copy,
    printFormat,
    spots: spotFingerprints(parts),
  });

async function recordPlaybook(db: Executor, campaignId: string, choice: PlaybookChoice) {
  if (choice.reading !== null) await saveDraftPlaybook(db, choice.playbook);
  await db
    .update(campaigns)
    .set({ brandPlaybookVersion: choice.playbook.version })
    .where(eq(campaigns.id, campaignId));
  await recordAudit(db, campaignId, {
    type: "PLAYBOOK_DRAFTED",
    payload: {
      brandId: choice.playbook.brandId,
      version: choice.playbook.version,
      reused: choice.reading === null,
      brandPage: choice.reading === null ? null : choice.reading.outcome,
    },
  });
}

export async function saveFirstProposal(
  db: Db,
  parts: CampaignParts,
  choice: PlaybookChoice,
  proposal: PlannedProposal,
): Promise<CampaignAssetRow | null> {
  const campaignId = parts.campaign.id;
  const budget = { amountMinor: parts.campaign.budgetMinor, currency: parts.campaign.currency };
  return db.transaction(async (tx) => {
    const campaign = await lockCampaign(tx, campaignId);
    if (campaign.status !== "PLANNING" || (await currentAsset(tx, campaignId)) !== null) {
      return null;
    }
    await recordPlaybook(tx, campaignId, choice);
    const [asset] = await tx
      .insert(campaignAssets)
      .values({
        campaignId,
        version: 1,
        templateVersion: cardTemplateVersion,
        headline: proposal.copy.headline,
        subcopy: proposal.copy.subcopy,
        printFormat: proposal.printFormat,
        steps: proposal.steps,
        estimatedSpendMinor: proposal.estimatedSpend.amountMinor,
        currency: proposal.estimatedSpend.currency,
        assumptions: proposal.assumptions,
        customerWarnings: proposal.customerWarnings,
        plannedByModel: proposal.model,
        assetHash: hashOfAsset(parts, proposal.copy, proposal.printFormat),
        spotsHash: spotsHash(spotFingerprints(parts)),
      })
      .returning();
    if (asset === undefined) throw new Error("Inserting the first proposal returned no row");
    await recordAudit(tx, campaignId, {
      type: "PLAN_GENERATED",
      payload: {
        model: proposal.model,
        assetVersion: 1,
        headline: proposal.copy.headline,
        steps: proposal.steps.length,
      },
    });
    await recordAudit(tx, campaignId, {
      type: "PLAN_VALIDATED",
      payload: {
        assetVersion: 1,
        estimatedSpend: proposal.estimatedSpend,
        budget,
        overBudget: compareMoney(proposal.estimatedSpend, budget) > 0,
      },
    });
    await moveStatus(tx, campaignId, "PLANNING", "AWAITING_APPROVAL");
    return asset;
  });
}

export async function publishCards(
  deps: CampaignServiceDeps,
  parts: CampaignParts,
  asset: CampaignAssetRow,
): Promise<void> {
  const cardSpots = parts.spots.map(({ spot }) => spot);
  await renderAssetCards(deps.assetDir, parts.brand.name, asset, cardSpots);
  await recordAudit(deps.db, asset.campaignId, {
    type: "CARDS_RENDERED",
    payload: {
      assetVersion: asset.version,
      assetHash: asset.assetHash,
      spotCodes: cardSpots.map((spot) => spot.code),
    },
  });
}
