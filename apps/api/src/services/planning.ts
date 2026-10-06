import { brandPageWarning, type CampaignView, type CostRates } from "@datum/core";
import type { CampaignAssetRow } from "@datum/db";
import type { ApiDeps } from "../deps";
import { conflict, unavailable, upstreamFailed } from "../http/errors";
import { PlannerModelError, type PlannerModel } from "../planner/model";
import { PlanRejectedError, planCampaign, type PlannedProposal } from "../planner/pipeline";
import type { PlannerInput } from "../planner/prompt";
import type { CampaignParts } from "../views/campaigns";
import { toCampaignView } from "../views/campaigns";
import { recordAudit } from "./audit";
import { campaignDetail, campaignParts } from "./campaigns";
import { choosePlaybook, type PlaybookChoice } from "./playbooks";
import { publishCards, saveFirstProposal } from "./proposals";
import { moveStatus } from "./status";

const requirePlanner = (deps: ApiDeps): PlannerModel => {
  if (deps.planner !== null) return deps.planner;
  throw unavailable(
    "PLANNER_UNAVAILABLE",
    "The AI planner is not configured: set ANTHROPIC_API_KEY",
  );
};

const requireRates = (deps: ApiDeps): CostRates => {
  if (deps.rates.configured) return deps.rates.rates;
  throw unavailable(
    "COST_RATES_MISSING",
    `Datum cannot price a plan until ${deps.rates.missing.join(" and ")} ${deps.rates.missing.length > 1 ? "are" : "is"} set`,
  );
};

const plannerInput = (parts: CampaignParts, choice: PlaybookChoice): PlannerInput => ({
  brandName: parts.brand.name,
  message: parts.campaign.message,
  destinationUrl: parts.campaign.destinationUrl,
  playbook: choice.playbook,
  spots: parts.spots.map(({ spot }) => spot),
  budget: { amountMinor: parts.campaign.budgetMinor, currency: parts.campaign.currency },
  deadline: parts.campaign.deadline.toISOString(),
  now: new Date().toISOString(),
});

async function draftProposal(
  deps: ApiDeps,
  campaignId: string,
  input: PlannerInput,
  choice: PlaybookChoice,
): Promise<PlannedProposal> {
  const pageWarning = choice.reading === null ? null : brandPageWarning(choice.reading);
  try {
    return await planCampaign(requirePlanner(deps), input, {
      rates: requireRates(deps),
      ruleWarnings: pageWarning === null ? [] : [pageWarning],
    });
  } catch (error) {
    if (error instanceof PlanRejectedError) {
      await recordAudit(deps.db, campaignId, {
        type: "PLAN_REJECTED",
        payload: { model: error.model, reason: error.reason, detail: error.message },
      });
      throw upstreamFailed("PLAN_REJECTED", `${error.reason}: ${error.message}`);
    }
    if (error instanceof PlannerModelError) {
      throw upstreamFailed("PLANNER_FAILED", `${error.code}: ${error.message}`);
    }
    throw error;
  }
}

const assertPlannable = (parts: CampaignParts): void => {
  const { status, deadline } = parts.campaign;
  if (status !== "DRAFT" && status !== "PLANNING") {
    throw conflict("INVALID_STATE", `A ${status} campaign cannot be planned`);
  }
  if (deadline.getTime() <= Date.now()) {
    throw conflict("DEADLINE_PASSED", "The campaign deadline has passed");
  }
};

export async function planProposal(deps: ApiDeps, campaignId: string): Promise<CampaignView> {
  const parts = await campaignParts(deps.db, campaignId);
  if (parts.asset !== null) return toCampaignView(parts, deps.appBaseUrl);
  assertPlannable(parts);
  requirePlanner(deps);
  requireRates(deps);
  if (parts.campaign.status === "DRAFT") {
    await deps.db.transaction((tx) => moveStatus(tx, campaignId, "DRAFT", "PLANNING"));
  }
  const choice = await choosePlaybook(deps.db, parts.brand, parts.campaign, deps.readBrandPage);
  const proposal = await draftProposal(deps, campaignId, plannerInput(parts, choice), choice);
  const asset: CampaignAssetRow | null = await saveFirstProposal(deps.db, parts, choice, proposal);
  if (asset !== null) await publishCards(deps, parts, asset);
  return campaignDetail(deps.db, deps.appBaseUrl, campaignId);
}
