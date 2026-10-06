import { Hono, type Context } from "hono";
import type { Db } from "@datum/db";
import { pathId, readBody } from "../http/input";
import { createCampaignSchema } from "../http/schemas";
import { campaignDetail, campaignTimeline, createCampaign } from "../services/campaigns";

const campaignId = (c: Context) => pathId(c, "id", "cmp", "Campaign");

export function campaignRoutes(db: Db, appBaseUrl: string) {
  return new Hono()
    .post("/campaigns", async (c) => {
      const input = await readBody(c, createCampaignSchema);
      return c.json(await createCampaign(db, appBaseUrl, input), 201);
    })
    .get("/campaigns/:id", async (c) => c.json(await campaignDetail(db, appBaseUrl, campaignId(c))))
    .get("/campaigns/:id/timeline", async (c) => c.json(await campaignTimeline(db, campaignId(c))));
}
