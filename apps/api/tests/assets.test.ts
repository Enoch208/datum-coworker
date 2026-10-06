import { rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeQr } from "./cards/decode";
import { fetchAsset, plannedCampaign } from "./flows";
import { app, assetDir, resetDatabaseBetweenTests } from "./support";

resetDatabaseBetweenTests();

describe("GET /assets/:campaignId/:version/:file", () => {
  it("serves cards with their type and a long cache", async () => {
    const campaign = await plannedCampaign();
    const [spot] = campaign.spots;
    const png = await fetchAsset(spot?.card?.pngUrl ?? "");
    expect(png.status).toBe(200);
    expect(png.headers.get("content-type")).toBe("image/png");
    expect(png.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(png.headers.get("x-content-type-options")).toBe("nosniff");
    const pdf = await fetchAsset(spot?.card?.pdfUrl ?? "");
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 5))).toBe("%PDF-");
  });

  it("re-renders a card whose file is gone from the database record", async () => {
    const campaign = await plannedCampaign();
    await rm(join(assetDir, campaign.id), { recursive: true });
    const spot = campaign.spots[1];
    const png = await fetchAsset(spot?.card?.pngUrl ?? "");
    expect(png.status).toBe(200);
    expect(await decodeQr(new Uint8Array(await png.arrayBuffer()))).toBe(spot?.qrTargetUrl);
  });

  it("answers 404 for traversal, malformed and unknown paths", async () => {
    const campaign = await plannedCampaign();
    const paths = [
      "/assets/../package.json",
      "/assets/%2e%2e/%2e%2e/package.json",
      `/assets/${campaign.id}/v1/..%2FA.png`,
      `/assets/${campaign.id}/v1/a.png`,
      `/assets/${campaign.id}/v1/A.svg`,
      `/assets/${campaign.id}/v0/A.png`,
      `/assets/${campaign.id}/1/A.png`,
      `/assets/${campaign.id}/v2/A.png`,
      `/assets/${campaign.id}/v1/Z.png`,
      "/assets/cmp_0000000000000000/v1/A.png",
      "/assets/not-a-campaign/v1/A.png",
    ];
    for (const path of paths) {
      const response = await app.request(path);
      expect(response.status, path).toBe(404);
    }
  });
});
