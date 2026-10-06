import { eq } from "drizzle-orm";
import {
  approvals,
  brandPlaybooks,
  campaignAssets,
  campaigns,
  type ApprovalRow,
  type CampaignAssetRow,
} from "@datum/db";
import { db } from "./support";

export async function attachPlaybook(campaignId: string, brandId: string): Promise<void> {
  await db.insert(brandPlaybooks).values({
    brandId,
    version: 1,
    defaultPrintFormat: "A6",
    defaultEvidencePolicy: "photo_with_decodable_spot_qr",
    maxAutonomousPhysicalSpendMinor: 5_000,
    currency: "SGD",
    forbiddenClaims: [],
    notes: [],
  });
  await db.update(campaigns).set({ brandPlaybookVersion: 1 }).where(eq(campaigns.id, campaignId));
}

export async function insertAsset(
  campaignId: string,
  version: number,
  overrides: Partial<typeof campaignAssets.$inferInsert> = {},
): Promise<CampaignAssetRow> {
  const [asset] = await db
    .insert(campaignAssets)
    .values({
      campaignId,
      version,
      templateVersion: 1,
      headline: `Headline v${String(version)}`,
      subcopy: "Show this card at Kopi Lab.",
      printFormat: "A6",
      steps: [
        {
          type: "PRINT_AND_COLLECT",
          quantity: 2,
          estimatedCost: { amountMinor: 300, currency: "SGD" },
        },
        {
          type: "PLACE_SPOT",
          spotCode: "A",
          estimatedCost: { amountMinor: 1_000, currency: "SGD" },
        },
      ],
      estimatedSpendMinor: 1_300,
      currency: "SGD",
      assumptions: ["One spare card"],
      customerWarnings: [],
      plannedByModel: "claude-sonnet-5-5",
      assetHash: String(version).repeat(64),
      spotsHash: "e".repeat(64),
      ...overrides,
    })
    .returning();
  if (asset === undefined) throw new Error("Inserting an asset returned no row");
  return asset;
}

export async function insertApproval(
  campaignId: string,
  assetVersion: number,
  version = 1,
): Promise<ApprovalRow> {
  const [approval] = await db
    .insert(approvals)
    .values({
      campaignId,
      version,
      assetVersion,
      assetHash: String(assetVersion).repeat(64),
      spotsHash: "e".repeat(64),
      approvedHeadline: `Headline v${String(assetVersion)}`,
      approvedSubcopy: "Show this card at Kopi Lab.",
      budgetMinor: 5_000,
      currency: "SGD",
      deadline: new Date("2026-10-07T09:00:00Z"),
      evidencePolicy: "photo_with_decodable_spot_qr",
      approvedBy: "Mei",
      approvedAt: new Date("2026-10-06T09:00:00Z"),
    })
    .returning();
  if (approval === undefined) throw new Error("Inserting an approval returned no row");
  return approval;
}
