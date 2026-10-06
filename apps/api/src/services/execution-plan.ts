import {
  assertExecutable,
  committedOpenSpend,
  ExecutionBlockedError,
  type ApprovalLock,
  type BudgetPosition,
  type Money,
  type PhysicalTaskDraft,
} from "@datum/core";
import type { CampaignAssetRow } from "@datum/db";
import { conflict } from "../http/errors";
import type { CampaignParts } from "../views/campaigns";
import { toApprovalLock } from "../views/proposal";
import { commissionDrafts } from "./commission";
import { budgetAffecting } from "./disputes";

export interface Executable {
  readonly lock: ApprovalLock;
  readonly asset: CampaignAssetRow;
}

export function executableOf(parts: CampaignParts): Executable {
  const { asset, approval, campaign } = parts;
  try {
    const lock = assertExecutable(
      approval === null ? null : toApprovalLock(approval),
      asset?.version ?? 0,
    );
    if (asset === null) throw new Error(`Campaign ${campaign.id} is approved without an asset`);
    return { lock, asset };
  } catch (error) {
    if (error instanceof ExecutionBlockedError) throw conflict(error.code, error.message);
    throw error;
  }
}

export function budgetPositionOf(parts: CampaignParts, budget: Money): BudgetPosition {
  const confirmedTasks = new Set(
    parts.expenses
      .filter((expense) => expense.status === "CONFIRMED")
      .map((expense) => expense.physicalTaskId),
  );
  return {
    approvedBudget: budget,
    expenses: budgetAffecting(parts.expenses).map((expense) => ({
      amount: { amountMinor: expense.amountMinor, currency: expense.currency },
      status: expense.status,
    })),
    committedOpenSpend: committedOpenSpend(
      parts.tasks.map(({ task }) => ({
        status: task.status,
        committed: { amountMinor: task.committedCostMinor, currency: task.currency },
        expenseConfirmed: confirmedTasks.has(task.id),
      })),
      budget.currency,
    ),
  };
}

export const plannedDrafts = (
  parts: CampaignParts,
  target: Executable,
  appBaseUrl: string,
): PhysicalTaskDraft[] =>
  commissionDrafts({
    campaignId: target.lock.campaignId,
    assetVersion: target.asset.version,
    printFormat: target.asset.printFormat,
    steps: target.asset.steps,
    spots: parts.spots.map(({ spot }) => spot),
    dueBy: target.lock.deadline,
    appBaseUrl,
  });

export const isPrintDraft = (draft: PhysicalTaskDraft): boolean =>
  draft.type === "PRINT_AND_COLLECT";
