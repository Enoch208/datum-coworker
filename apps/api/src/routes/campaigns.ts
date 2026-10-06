import { Hono, type Context } from "hono";
import type { CampaignReceiptRow, Db } from "@datum/db";
import type { ApiDeps } from "../deps";
import { pathId, readBody } from "../http/input";
import {
  acceptExpenseSchema,
  approveCampaignSchema,
  createCampaignSchema,
  editCopySchema,
  raiseBudgetSchema,
} from "../http/schemas";
import { raiseBudget } from "../services/budget-raise";
import { storedReceipt } from "../services/campaign-receipt";
import { campaignPaymentEvidence } from "../services/coworker-payment";
import { goalState } from "../services/goal-state";
import { toCampaignReceiptView } from "../views/campaign-receipt";
import { HttpError } from "../http/errors";
import { acceptDisputedExpense } from "../services/disputes";
import { approveProposal } from "../services/approvals";
import {
  campaignDetail,
  campaignTimeline,
  createCampaign,
  findCampaign,
} from "../services/campaigns";
import { editCopy } from "../services/copy-edits";
import { planProposal } from "../services/planning";
import { startCampaign } from "../services/start";

const campaignId = (c: Context) => pathId(c, "id", "cmp", "Campaign");

async function publishedReceipt(db: Db, id: string): Promise<CampaignReceiptRow> {
  await findCampaign(db, id);
  const row = await storedReceipt(db, id);
  if (row === null) {
    throw new HttpError(
      404,
      "NO_RECEIPT",
      "The Campaign Receipt is published when the campaign ends",
    );
  }
  return row;
}

export function campaignRoutes(deps: ApiDeps) {
  const { db, appBaseUrl } = deps;
  return new Hono()
    .post("/campaigns", async (c) => {
      const input = await readBody(c, createCampaignSchema);
      return c.json(await createCampaign(db, appBaseUrl, input), 201);
    })
    .get("/campaigns/:id", async (c) => c.json(await campaignDetail(db, appBaseUrl, campaignId(c))))
    .get("/campaigns/:id/timeline", async (c) => c.json(await campaignTimeline(db, campaignId(c))))
    .get("/campaigns/:id/goal", async (c) => c.json(await goalState(db, campaignId(c), new Date())))
    .get("/campaigns/:id/receipt", async (c) => {
      const id = campaignId(c);
      const row = await publishedReceipt(db, id);
      return c.json(toCampaignReceiptView(row, await campaignPaymentEvidence(db, id)));
    })
    .get("/campaigns/:id/receipt/canonical", async (c) => {
      const row = await publishedReceipt(db, campaignId(c));
      return c.body(row.canonicalJson, 200, {
        "content-type": "application/json; charset=utf-8",
        "x-content-sha256": row.sha256,
      });
    })
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
    })
    .post("/campaigns/:id/start", async (c) => c.json(await startCampaign(deps, campaignId(c))))
    .post("/campaigns/:id/budget", async (c) => {
      const id = campaignId(c);
      const input = await readBody(c, raiseBudgetSchema);
      return c.json(await raiseBudget(deps, id, input));
    })
    .post("/campaigns/:id/expenses/:expenseId/accept", async (c) => {
      const id = campaignId(c);
      const input = await readBody(c, acceptExpenseSchema);
      return c.json(await acceptDisputedExpense(deps, id, c.req.param("expenseId"), input));
    });
}
