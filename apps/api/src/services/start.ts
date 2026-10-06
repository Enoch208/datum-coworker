import {
  checkBudget,
  confirmedSpend,
  sumMoney,
  type CampaignStatus,
  type CampaignView,
  type Money,
  type PhysicalTaskDraft,
} from "@datum/core";
import type { Executor } from "@datum/db";
import type { ApiDeps } from "../deps";
import { NoRunnerAvailableError } from "../executor/local-dispatch";
import { localEnrolledRunner } from "../executor/local-runner";
import { conflict } from "../http/errors";
import { recordAudit } from "./audit";
import { campaignDetail, campaignParts } from "./campaigns";
import { budgetPositionOf, executableOf, isPrintDraft, plannedDrafts } from "./execution-plan";
import { requireRates } from "./rates";
import { lockCampaign, moveStatus } from "./status";

const notYetStarted: ReadonlySet<CampaignStatus> = new Set([
  "DRAFT",
  "PLANNING",
  "AWAITING_APPROVAL",
  "APPROVED",
]);

async function stopForApproval(
  db: Executor,
  campaignId: string,
  estimated: Money,
  budget: Money,
  shortfall: Money,
) {
  await moveStatus(db, campaignId, "APPROVED", "NEEDS_APPROVAL");
  await recordAudit(db, campaignId, {
    type: "APPROVAL_REQUESTED",
    payload: { reason: "OVER_BUDGET", estimated, budget, shortfall },
  });
}

async function commission(deps: ApiDeps, db: Executor, drafts: readonly PhysicalTaskDraft[]) {
  const executor = localEnrolledRunner({
    db,
    appBaseUrl: deps.appBaseUrl,
    rates: requireRates(deps),
  });
  try {
    for (const draft of drafts) await executor.createTask(draft);
  } catch (error) {
    if (error instanceof NoRunnerAvailableError) {
      throw conflict("NO_RUNNER", "Enroll a runner with an active link before starting");
    }
    throw error;
  }
}

async function startLocked(deps: ApiDeps, db: Executor, campaignId: string): Promise<void> {
  const campaign = await lockCampaign(db, campaignId);
  if (!notYetStarted.has(campaign.status)) return;
  const parts = await campaignParts(db, campaignId);
  const target = executableOf(parts);
  if (campaign.status !== "APPROVED") {
    throw conflict("INVALID_STATE", `A ${campaign.status} campaign cannot start`);
  }
  if (campaign.deadline.getTime() <= Date.now()) {
    throw conflict("DEADLINE_PASSED", "The campaign deadline has passed");
  }
  const drafts = plannedDrafts(parts, target, deps.appBaseUrl);
  const budget = target.lock.budget;
  const estimated = sumMoney(
    drafts.map((draft) => draft.estimatedCost),
    budget.currency,
  );
  const position = budgetPositionOf(parts, budget);
  const decision = checkBudget({ ...position, estimatedActionCost: estimated });
  if (decision.decision === "NEEDS_APPROVAL") {
    await stopForApproval(db, campaignId, estimated, budget, decision.shortfall);
    return;
  }
  await moveStatus(db, campaignId, "APPROVED", "EXECUTING");
  await recordAudit(db, campaignId, {
    type: "BUDGET_CHECKED",
    payload: {
      stage: "PLAN",
      tasks: drafts.length,
      estimated,
      confirmedSpend: confirmedSpend(position.expenses, budget.currency),
      committedSpend: position.committedOpenSpend,
      budget,
    },
  });
  await commission(deps, db, drafts.filter(isPrintDraft));
}

export async function startCampaign(deps: ApiDeps, campaignId: string): Promise<CampaignView> {
  requireRates(deps);
  await deps.db.transaction((tx) => startLocked(deps, tx, campaignId));
  return campaignDetail(deps.db, deps.appBaseUrl, campaignId);
}
