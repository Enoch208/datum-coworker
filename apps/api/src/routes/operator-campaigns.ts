import { and, eq } from "drizzle-orm";
import { isSpotCode } from "@datum/core";
import { spots } from "@datum/db";
import { Hono } from "hono";
import type { ApiDeps } from "../deps";
import { notFound } from "../http/errors";
import { pathId, readBody } from "../http/input";
import { requireOperator } from "../http/operator";
import { labelInducedMissSchema } from "../http/operator-schemas";
import { campaignDetail } from "../services/campaigns";

export function operatorCampaignRoutes(deps: ApiDeps) {
  return new Hono()
    .use("/operator/campaigns/*", requireOperator(deps.operatorKey))
    .post("/operator/campaigns/:id/spots/:code/induced-miss", async (c) => {
      const campaignId = pathId(c, "id", "cmp", "Campaign");
      const code = c.req.param("code");
      const { inducedMiss } = await readBody(c, labelInducedMissSchema);
      const labelled = isSpotCode(code)
        ? await deps.db
            .update(spots)
            .set({ inducedMiss })
            .where(and(eq(spots.campaignId, campaignId), eq(spots.code, code)))
            .returning({ id: spots.id })
        : [];
      if (labelled.length === 0) throw notFound("Spot", `${campaignId}/${code}`);
      return c.json(await campaignDetail(deps.db, deps.appBaseUrl, campaignId));
    });
}
