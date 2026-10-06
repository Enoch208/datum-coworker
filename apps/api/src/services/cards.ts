import { and, eq } from "drizzle-orm";
import {
  brands,
  campaignAssets,
  campaigns,
  spots,
  type CampaignAssetRow,
  type Executor,
} from "@datum/db";
import { renderCard } from "../cards/render";
import { cardAssetKey, readAsset, writeAsset, type CardFile } from "../cards/store";
import { cardTemplateVersion } from "../cards/template";

export interface CardSpot {
  readonly code: string;
  readonly qrTargetUrl: string;
}

export async function renderSpotCard(
  assetDir: string,
  brandName: string,
  asset: CampaignAssetRow,
  spot: CardSpot,
): Promise<void> {
  if (asset.templateVersion !== cardTemplateVersion) {
    throw new Error(
      `Asset v${String(asset.version)} used card template ${String(asset.templateVersion)}, not ${String(cardTemplateVersion)}`,
    );
  }
  const rendered = await renderCard(
    {
      brandName,
      copy: { headline: asset.headline, subcopy: asset.subcopy },
      printFormat: asset.printFormat,
      spotCode: spot.code,
      qrTargetUrl: spot.qrTargetUrl,
    },
    asset.createdAt,
  );
  const key = (file: CardFile) => cardAssetKey(asset.campaignId, asset.version, spot.code, file);
  await writeAsset(assetDir, key("png"), rendered.png);
  await writeAsset(assetDir, key("pdf"), rendered.pdf);
}

export async function renderAssetCards(
  assetDir: string,
  brandName: string,
  asset: CampaignAssetRow,
  cardSpots: readonly CardSpot[],
): Promise<void> {
  for (const spot of cardSpots) {
    await renderSpotCard(assetDir, brandName, asset, spot);
  }
}

async function cardSource(db: Executor, campaignId: string, version: number, spotCode: string) {
  const [source] = await db
    .select({ asset: campaignAssets, spot: spots, brandName: brands.name })
    .from(campaignAssets)
    .innerJoin(campaigns, eq(campaigns.id, campaignAssets.campaignId))
    .innerJoin(brands, eq(brands.id, campaigns.brandId))
    .innerJoin(spots, and(eq(spots.campaignId, campaigns.id), eq(spots.code, spotCode)))
    .where(and(eq(campaignAssets.campaignId, campaignId), eq(campaignAssets.version, version)));
  return source ?? null;
}

export interface CardFileRequest {
  readonly campaignId: string;
  readonly version: number;
  readonly spotCode: string;
  readonly file: CardFile;
}

export async function cardFile(
  db: Executor,
  assetDir: string,
  request: CardFileRequest,
): Promise<Buffer | null> {
  const { campaignId, version, spotCode, file } = request;
  const key = cardAssetKey(campaignId, version, spotCode, file);
  const stored = await readAsset(assetDir, key);
  if (stored !== null) return stored;
  const source = await cardSource(db, campaignId, version, spotCode);
  if (source === null) return null;
  await renderSpotCard(assetDir, source.brandName, source.asset, source.spot);
  return readAsset(assetDir, key);
}
