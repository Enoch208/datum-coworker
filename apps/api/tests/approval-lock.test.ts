import type { CampaignView } from "@datum/core";
import { describe, expect, it } from "vitest";
import { appBaseUrl, call, createCampaign, resetDatabaseBetweenTests } from "./support";
import { attachPlaybook, insertApproval, insertAsset } from "./rows";

resetDatabaseBetweenTests();

describe("asset versions and the approval lock in Postgres", () => {
  it("refuses an approval of an asset version that does not exist", async () => {
    const campaign = await createCampaign();
    await insertAsset(campaign.id, 1);
    await expect(insertApproval(campaign.id, 2)).rejects.toMatchObject({
      cause: { code: "23503", constraint_name: "approvals_campaign_asset_fk" },
    });
  });

  it("refuses a second asset with the same version", async () => {
    const campaign = await createCampaign();
    await insertAsset(campaign.id, 1);
    await expect(insertAsset(campaign.id, 1)).rejects.toMatchObject({
      cause: { code: "23505", constraint_name: "campaign_assets_campaign_version_unique" },
    });
  });

  it("refuses an asset hash that is not a sha256 digest", async () => {
    const campaign = await createCampaign();
    await expect(insertAsset(campaign.id, 1, { assetHash: "not-a-hash" })).rejects.toMatchObject({
      cause: { code: "23514", constraint_name: "campaign_assets_asset_hash_is_sha256" },
    });
  });
});

describe("GET /campaigns/:id with a proposal", () => {
  it("shows the current proposal, its approval and a card per spot", async () => {
    const campaign = await createCampaign();
    await attachPlaybook(campaign.id, campaign.brand.id);
    await insertAsset(campaign.id, 1);
    await insertApproval(campaign.id, 1);
    const { body } = await call<CampaignView>("GET", `/campaigns/${campaign.id}`);
    expect(body.proposal).toMatchObject({
      assetVersion: 1,
      copy: { headline: "Headline v1", subcopy: "Show this card at Kopi Lab." },
      steps: [
        {
          type: "PRINT_AND_COLLECT",
          quantity: 2,
          estimatedCost: { amount: "3.00", currency: "SGD" },
        },
        { type: "PLACE_SPOT", spotCode: "A", estimatedCost: { amount: "10.00", currency: "SGD" } },
      ],
      estimatedSpend: { amount: "13.00", currency: "SGD" },
      evidencePolicy: "photo_with_decodable_spot_qr",
      plannedBy: { model: "claude-sonnet-5-5" },
    });
    expect(body.approval).toMatchObject({
      version: 1,
      assetVersion: 1,
      copy: { headline: "Headline v1" },
      budget: { amount: "50.00", currency: "SGD" },
      approvedBy: "Mei",
      current: true,
    });
    expect(body.spots.map((spot) => spot.card)).toEqual(
      ["A", "B"].map((code) => ({
        pngUrl: `${appBaseUrl}/assets/${campaign.id}/v1/${code}.png`,
        pdfUrl: `${appBaseUrl}/assets/${campaign.id}/v1/${code}.pdf`,
      })),
    );
  });

  it("marks the approval as no longer current once a newer asset exists", async () => {
    const campaign = await createCampaign();
    await attachPlaybook(campaign.id, campaign.brand.id);
    await insertAsset(campaign.id, 1);
    await insertApproval(campaign.id, 1);
    await insertAsset(campaign.id, 2);
    const { body } = await call<CampaignView>("GET", `/campaigns/${campaign.id}`);
    expect(body.proposal?.assetVersion).toBe(2);
    expect(body.approval).toMatchObject({ assetVersion: 1, current: false });
    expect(body.spots[0]?.card?.pngUrl).toBe(`${appBaseUrl}/assets/${campaign.id}/v2/A.png`);
  });
});
