import { asc, count, desc, eq } from "drizzle-orm";
import { approvals, brands, campaigns, scanEvents, spots, type Db, type Executor } from "@datum/db";
import { notFound } from "../http/errors";
import type { CreateCampaignInput } from "../http/schemas";
import { toApprovalLock, toCampaignView, toSpotView } from "../views/campaigns";
import { auditTrail, recordAudit } from "./audit";
import { ensureBrand } from "./brands";
import { spotScanUrl } from "./scans";

export async function createCampaign(db: Db, appBaseUrl: string, input: CreateCampaignInput) {
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
        qrTargetUrl: spotScanUrl(appBaseUrl, campaign.id, spot.code),
      })),
    );
    await recordAudit(tx, campaign.id, "CAMPAIGN_CREATED", {
      brandId: brand.id,
      spotCodes: input.spots.map((spot) => spot.code),
      budget: input.budget,
      deadline: input.deadline.toISOString(),
    });
    return campaign.id;
  });
  return campaignDetail(db, campaignId);
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

export async function campaignDetail(db: Executor, campaignId: string) {
  const { campaign, brand } = await findCampaign(db, campaignId);
  const spotRows = await db
    .select({ spot: spots, scans: count(scanEvents.id) })
    .from(spots)
    .leftJoin(scanEvents, eq(scanEvents.spotId, spots.id))
    .where(eq(spots.campaignId, campaignId))
    .groupBy(spots.id)
    .orderBy(asc(spots.code));
  const [approval] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.campaignId, campaignId))
    .orderBy(desc(approvals.version))
    .limit(1);
  return {
    campaign: toCampaignView(campaign, brand),
    spots: spotRows.map((row) => toSpotView(row.spot, row.scans)),
    approval: approval === undefined ? null : toApprovalLock(approval),
  };
}

export async function campaignTimeline(db: Executor, campaignId: string) {
  await findCampaign(db, campaignId);
  return auditTrail(db, campaignId);
}
