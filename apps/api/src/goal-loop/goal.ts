import {
  evaluateGoal,
  isApprovalCurrent,
  isOpenTaskStatus,
  type GoalEvaluation,
  type RemediationAuthority,
} from "@datum/core";
import { budgetPositionOf, type Executable } from "../services/execution-plan";
import { spotHistory } from "../services/spot-outcomes";
import type { CampaignParts } from "../views/campaigns";

const budgetAffecting = (parts: CampaignParts) =>
  parts.expenses.map((expense) => ({
    amount: { amountMinor: expense.amountMinor, currency: expense.currency },
    status: expense.status,
  }));

export function evaluateCampaign(
  parts: CampaignParts,
  target: Executable,
  now: Date,
): GoalEvaluation {
  const tasks = parts.tasks.map(({ task }) => task);
  return evaluateGoal({
    spots: parts.spots.map(({ spot }) => spotHistory(spot, tasks, parts.evidence)),
    approvalValid: isApprovalCurrent(target.lock, target.asset.version),
    now: now.toISOString(),
    deadline: target.lock.deadline,
    approvedBudget: target.lock.budget,
    expenses: budgetAffecting(parts),
  });
}

export function remediationAuthority(
  parts: CampaignParts,
  target: Executable,
  goal: GoalEvaluation,
  now: Date,
): RemediationAuthority {
  return {
    campaignId: parts.campaign.id,
    approvedSpotCodes: parts.spots.map(({ spot }) => spot.code),
    unresolved: goal.unresolved,
    approvedAssetVersion: target.lock.assetVersion,
    approvedCopy: target.lock.approvedCopy,
    budget: budgetPositionOf(parts, target.lock.budget),
    deadline: target.lock.deadline,
    now: now.toISOString(),
    tasks: parts.tasks.flatMap(({ task, spotCode }) =>
      task.type === "PLACE_SPOT" && spotCode !== null
        ? [
            {
              idempotencyKey: task.idempotencyKey,
              spotCodes: [spotCode],
              open: isOpenTaskStatus(task.status),
            },
          ]
        : [],
    ),
  };
}
