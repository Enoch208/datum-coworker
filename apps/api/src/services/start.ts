import {
  assertExecutable,
  checkBudget,
  committedOpenSpend,
  ExecutionBlockedError,
  sumMoney,
  type ApprovalLock,
  type CampaignStatus,
  type CampaignView,
  type Money,
  type PhysicalTaskDraft,
} from "@datum/core";
import type { CampaignAssetRow, Executor } from "@datum/db";
import type { ApiDeps } from "../deps";
import { NoRunnerAvailableError } from "../executor/local-dispatch";
import { localEnrolledRunner } from "../executor/local-runner";
import { conflict } from "../http/errors";
import { toApprovalLock } from "../views/proposal";
import { recordAudit } from "./audit";
import { campaignDetail, campaignParts, currentAsset, latestApproval } from "./campaigns";
import { commissionDrafts } from "./commission";
import { requireRates } from "./rates";
import { lockCampaign, moveStatus } from "./status";

const notYetStarted: ReadonlySet<CampaignStatus> = new Set([
  "DRAFT",
  "PLANNING",
  "AWAITING_APPROVAL",
  "APPROVED",
]);

interface Executable {
  readonly lock: ApprovalLock;
  readonly asset: CampaignAssetRow;
}

async function executable(db: Executor, campaignId: string): Promise<Executable> {
  const asset = await currentAsset(db, campaignId);
  const approval = await latestApproval(db, campaignId);
  try {
    const lock = assertExecutable(
      approval === null ? null : toApprovalLock(approval),
      asset?.version ?? 0,
    );
    if (asset === null) throw new Error(`Campaign ${campaignId} is approved without an asset`);
    return { lock, asset };
  } catch (error) {
    if (error instanceof ExecutionBlockedError) throw conflict(error.code, error.message);
    throw error;
  }
}

async function budgetPosition(db: Executor, campaignId: string, budget: Money) {
  const parts = await campaignParts(db, campaignId);
  return {
    approvedBudget: budget,
    expenses: parts.expenses.map((expense) => ({
      amount: { amountMinor: expense.amountMinor, currency: expense.currency },
      status: expense.status,
    })),
    committedOpenSpend: committedOpenSpend(
      parts.tasks.map(({ task }) => ({
        status: task.status,
        committed: { amountMinor: task.committedCostMinor, currency: task.currency },
        expenseConfirmed: parts.expenses.some(
          (expense) => expense.physicalTaskId === task.id && expense.status === "CONFIRMED",
        ),
      })),
      budget.currency,
    ),
  };
}

async function draftsFor(deps: ApiDeps, db: Executor, target: Executable) {
  const parts = await campaignParts(db, target.lock.campaignId);
  return commissionDrafts({
    campaignId: target.lock.campaignId,
    assetVersion: target.asset.version,
    printFormat: target.asset.printFormat,
    steps: target.asset.steps,
    spots: parts.spots.map(({ spot }) => spot),
    dueBy: target.lock.deadline,
    appBaseUrl: deps.appBaseUrl,
  });
}

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
  const target = await executable(db, campaignId);
  if (campaign.status !== "APPROVED") {
    throw conflict("INVALID_STATE", `A ${campaign.status} campaign cannot start`);
  }
  if (campaign.deadline.getTime() <= Date.now()) {
    throw conflict("DEADLINE_PASSED", "The campaign deadline has passed");
  }
  const drafts = await draftsFor(deps, db, target);
  const budget = target.lock.budget;
  const estimated = sumMoney(
    drafts.map((draft) => draft.estimatedCost),
    budget.currency,
  );
  const decision = checkBudget({
    ...(await budgetPosition(db, campaignId, budget)),
    estimatedActionCost: estimated,
  });
  if (decision.decision === "NEEDS_APPROVAL") {
    await stopForApproval(db, campaignId, estimated, budget, decision.shortfall);
    return;
  }
  await moveStatus(db, campaignId, "APPROVED", "EXECUTING");
  await commission(deps, db, drafts);
}

export async function startCampaign(deps: ApiDeps, campaignId: string): Promise<CampaignView> {
  requireRates(deps);
  await deps.db.transaction((tx) => startLocked(deps, tx, campaignId));
  return campaignDetail(deps.db, deps.appBaseUrl, campaignId);
}
