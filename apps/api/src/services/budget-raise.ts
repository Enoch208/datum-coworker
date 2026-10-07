import {
  compareMoney,
  formatMoney,
  toWireMoney,
  type CampaignView,
  type Money,
  type RaiseBudgetRequest,
} from "@datum/core";
import { approvals, campaigns, type Executor } from "@datum/db";
import { eq } from "drizzle-orm";
import type { ApiDeps } from "../deps";
import { conflict } from "../http/errors";
import { registeredOwnerKey, verifyOwnerSignature } from "../http/owner";
import { recordAudit } from "./audit";
import { campaignDetail, latestApproval } from "./campaigns";
import { recordIntervention } from "./interventions";
import { lockCampaign, moveStatus } from "./status";

export interface RaiseBudgetInput extends Omit<RaiseBudgetRequest, "budget"> {
  readonly budget: Money;
}

async function raiseLocked(db: Executor, campaignId: string, input: RaiseBudgetInput) {
  const campaign = await lockCampaign(db, campaignId);
  if (campaign.status !== "NEEDS_APPROVAL") {
    throw conflict("INVALID_STATE", `A ${campaign.status} campaign is not waiting for a budget`);
  }
  const approval = await latestApproval(db, campaignId);
  if (approval === null) throw conflict("NO_APPROVAL", "This campaign was never approved");
  const current = { amountMinor: approval.budgetMinor, currency: approval.currency };
  if (compareMoney(input.budget, current) <= 0) {
    throw conflict(
      "BUDGET_NOT_RAISED",
      `The new budget must be more than the approved ${formatMoney(current)}`,
    );
  }
  const ownerStatement = verifyOwnerSignature(
    registeredOwnerKey(campaign),
    {
      action: "RAISE_BUDGET",
      campaignId,
      approvalVersion: approval.version,
      budget: toWireMoney(input.budget),
      approvedBy: input.approvedBy,
    },
    input.signature,
  );
  const approvedAt = new Date();
  await db.insert(approvals).values({
    campaignId,
    version: approval.version + 1,
    assetVersion: approval.assetVersion,
    assetHash: approval.assetHash,
    spotsHash: approval.spotsHash,
    approvedHeadline: approval.approvedHeadline,
    approvedSubcopy: approval.approvedSubcopy,
    currency: approval.currency,
    deadline: approval.deadline,
    evidencePolicy: approval.evidencePolicy,
    budgetMinor: input.budget.amountMinor,
    approvedBy: input.approvedBy,
    approvedAt,
    ownerStatement,
    ownerSignature: input.signature,
  });
  await db
    .update(campaigns)
    .set({ budgetMinor: input.budget.amountMinor })
    .where(eq(campaigns.id, campaignId));
  await recordAudit(db, campaignId, {
    type: "CAMPAIGN_APPROVED",
    payload: {
      approvalVersion: approval.version + 1,
      assetVersion: approval.assetVersion,
      assetHash: approval.assetHash,
      spotsHash: approval.spotsHash,
      approvedBy: input.approvedBy,
      budget: input.budget,
      deadline: approval.deadline.toISOString(),
    },
  });
  await recordIntervention(db, {
    campaignId,
    actor: "CUSTOMER",
    actorName: input.approvedBy,
    action: "BUDGET_RAISED",
    reason: `raised the approved budget from ${formatMoney(current)} to ${formatMoney(input.budget)}`,
    ownerStatement,
    ownerSignature: input.signature,
  });
  await moveStatus(db, campaignId, "NEEDS_APPROVAL", "EXECUTING");
}

export async function raiseBudget(
  deps: ApiDeps,
  campaignId: string,
  input: RaiseBudgetInput,
): Promise<CampaignView> {
  await deps.db.transaction((tx) => raiseLocked(tx, campaignId, input));
  return campaignDetail(deps.db, deps.appBaseUrl, campaignId);
}
