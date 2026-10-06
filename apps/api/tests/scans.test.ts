import { eq } from "drizzle-orm";
import { scanEvents, spots } from "@datum/db";
import { describe, expect, it } from "vitest";
import {
  app,
  call,
  createCampaign,
  db,
  resetDatabaseBetweenTests,
  type CampaignDetail,
} from "./support";

resetDatabaseBetweenTests();

async function scan(path: string, userAgent = "Mozilla/5.0 (iPhone)"): Promise<Response> {
  return app.request(path, { headers: { "user-agent": userAgent } });
}

describe("GET /c/:campaignId/:spotCode", () => {
  it("records each scan and redirects to the campaign destination", async () => {
    const { campaign } = await createCampaign();
    const first = await scan(`/c/${campaign.id}/A`);
    const second = await scan(`/c/${campaign.id}/A`, "x".repeat(1_000));
    for (const response of [first, second]) {
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("https://kopilab.example/offer");
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    const detail = await call<CampaignDetail>("GET", `/campaigns/${campaign.id}`);
    expect(detail.body.spots.map((spot) => [spot.code, spot.scanCount])).toEqual([
      ["A", 2],
      ["B", 0],
    ]);
    const rows = await db.select().from(scanEvents);
    expect(rows.map((row) => row.userAgent?.length)).toEqual(expect.arrayContaining([20, 256]));
  });

  it("stores no network address and leaves spot outcomes and the timeline untouched", async () => {
    const { campaign } = await createCampaign();
    await scan(`/c/${campaign.id}/B`);
    const [row] = await db.select().from(scanEvents);
    expect(Object.keys(row ?? {}).sort()).toEqual(["id", "scannedAt", "spotId", "userAgent"]);
    const [spot] = await db.select().from(spots).where(eq(spots.code, "B"));
    expect(spot).toMatchObject({ status: "PENDING", firstPassStatus: "PENDING" });
    const timeline = await call<unknown[]>("GET", `/campaigns/${campaign.id}/timeline`);
    expect(timeline.body).toHaveLength(1);
  });

  it("answers unknown spots and campaigns with a JSON 404 and records nothing", async () => {
    const { campaign } = await createCampaign();
    for (const path of [
      `/c/${campaign.id}/Z`,
      "/c/cmp_0000000000000000/A",
      "/c/not-a-campaign/A",
    ]) {
      const response = await scan(path);
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: "NOT_FOUND" });
    }
    expect(await db.select().from(scanEvents)).toEqual([]);
  });
});
