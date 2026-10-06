import { Hono, type Context } from "hono";
import type { ApiDeps } from "../deps";
import { pathId, readBody } from "../http/input";
import { approveCampaignSchema, createCampaignSchema, editCopySchema } from "../http/schemas";
import { approveProposal } from "../services/approvals";
import { campaignDetail, campaignTimeline, createCampaign } from "../services/campaigns";
import { editCopy } from "../services/copy-edits";
import { planProposal } from "../services/planning";

const campaignId = (c: Context) => pathId(c, "id", "cmp", "Campaign");

export function campaignRoutes(deps: ApiDeps) {
  const { db, appBaseUrl } = deps;
  return new Hono()
    .post("/campaigns", async (c) => {
      const input = await readBody(c, createCampaignSchema);
      return c.json(await createCampaign(db, appBaseUrl, input), 201);
    })
    .get("/campaigns/:id", async (c) => c.json(await campaignDetail(db, appBaseUrl, campaignId(c))))
    .get("/campaigns/:id/timeline", async (c) => c.json(await campaignTimeline(db, campaignId(c))))
    .post("/campaigns/:id/plan", async (c) => c.json(await planProposal(deps, campaignId(c))))
    .patch("/campaigns/:id/copy", async (c) => {
      const id = campaignId(c);
      const { copy } = await readBody(c, editCopySchema);
      return c.json(await editCopy(deps, id, copy));
    })
    .post("/campaigns/:id/approve", async (c) => {
      const id = campaignId(c);
      const request = await readBody(c, approveCampaignSchema);
      return c.json(await approveProposal(deps, id, request));
    });
}
