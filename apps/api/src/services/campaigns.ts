import { and, asc, count, desc, eq } from "drizzle-orm";
import { buildSpotQrUrl, type CampaignView } from "@datum/core";
import {
  approvals,
  brandPlaybooks,
  brands,
  campaignAssets,
  campaigns,
  scanEvents,
  spots,
  type Db,
  type Executor,
} from "@datum/db";
import { notFound } from "../http/errors";
import type { CreateCampaignInput } from "../http/schemas";
import { toCampaignView, type CampaignParts } from "../views/campaigns";
import { auditTrail, recordAudit } from "./audit";
import { ensureBrand } from "./brands";
import { campaignExpenses, campaignTasks } from "./execution-reads";

export async function createCampaign(
  db: Db,
  appBaseUrl: string,
  input: CreateCampaignInput,
): Promise<CampaignView> {
  const campaignId = await db.transaction(async (tx) => {
    const brand = await ensureBrand(tx, input.brandName, input.brandUrl);
    const [campaign] = await tx
      .insert(campaigns)
      .values({
        brandId: brand.id,
        message: input.message,
        destinationUrl: input.destinationUrl,
        deadline: input.deadline,
        budgetMinor: input.budget.amountMinor,
        currency: input.budget.currency,
      })
      .returning({ id: campaigns.id });
    if (campaign === undefined) {
      throw new Error("Inserting a campaign returned no row");
    }
    await tx.insert(spots).values(
      input.spots.map((spot) => ({
        campaignId: campaign.id,
        code: spot.code,
        name: spot.name,
        instructions: spot.instructions,
        qrTargetUrl: buildSpotQrUrl(appBaseUrl, { campaignId: campaign.id, spotCode: spot.code }),
      })),
    );
    await recordAudit(tx, campaign.id, {
      type: "CAMPAIGN_CREATED",
      payload: {
        brandId: brand.id,
        spotCodes: input.spots.map((spot) => spot.code),
        budget: input.budget,
        deadline: input.deadline.toISOString(),
      },
    });
    return campaign.id;
  });
  return campaignDetail(db, appBaseUrl, campaignId);
}

async function findCampaign(db: Executor, campaignId: string) {
  const [row] = await db
    .select({ campaign: campaigns, brand: brands })
    .from(campaigns)
    .innerJoin(brands, eq(campaigns.brandId, brands.id))
    .where(eq(campaigns.id, campaignId));
  if (row === undefined) {
    throw notFound("Campaign", campaignId);
  }
  return row;
}

export async function campaignPlaybook(db: Executor, brandId: string, version: number | null) {
  if (version === null) return null;
  const [playbook] = await db
    .select()
    .from(brandPlaybooks)
    .where(and(eq(brandPlaybooks.brandId, brandId), eq(brandPlaybooks.version, version)));
  if (playbook === undefined) {
    throw new Error(`Brand ${brandId} has no playbook version ${String(version)}`);
  }
  return playbook;
}

async function campaignSpots(db: Executor, campaignId: string) {
  return db
    .select({ spot: spots, scans: count(scanEvents.id) })
    .from(spots)
    .leftJoin(scanEvents, eq(scanEvents.spotId, spots.id))
    .where(eq(spots.campaignId, campaignId))
    .groupBy(spots.id)
    .orderBy(asc(spots.code));
}

export async function currentAsset(db: Executor, campaignId: string) {
  const [asset] = await db
    .select()
    .from(campaignAssets)
    .where(eq(campaignAssets.campaignId, campaignId))
    .orderBy(desc(campaignAssets.version))
    .limit(1);
  return asset ?? null;
}

export async function latestApproval(db: Executor, campaignId: string) {
  const [approval] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.campaignId, campaignId))
    .orderBy(desc(approvals.version))
    .limit(1);
  return approval ?? null;
}

export async function campaignParts(db: Executor, campaignId: string): Promise<CampaignParts> {
  const { campaign, brand } = await findCampaign(db, campaignId);
  return {
    campaign,
    brand,
    playbook: await campaignPlaybook(db, brand.id, campaign.brandPlaybookVersion),
    spots: await campaignSpots(db, campaignId),
    asset: await currentAsset(db, campaignId),
    approval: await latestApproval(db, campaignId),
    tasks: await campaignTasks(db, campaignId),
    expenses: await campaignExpenses(db, campaignId),
  };
}

export async function campaignDetail(
  db: Executor,
  appBaseUrl: string,
  campaignId: string,
): Promise<CampaignView> {
  return toCampaignView(await campaignParts(db, campaignId), appBaseUrl);
}

export async function campaignTimeline(db: Executor, campaignId: string) {
  await findCampaign(db, campaignId);
  return auditTrail(db, campaignId);
}
