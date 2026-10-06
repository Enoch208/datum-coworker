import {
  confirmedSpend,
  isOpenTaskStatus,
  passedAt,
  remainingBudget,
  spotOutcome,
  toWireMoney,
  type GoalRequirementView,
  type GoalStateView,
  type UnresolvedRequirement,
} from "@datum/core";
import type { Db } from "@datum/db";
import { latestDecision } from "../goal-loop/decisions";
import { evaluateCampaign } from "../goal-loop/goal";
import type { CampaignParts, SpotWithScans } from "../views/campaigns";
import { toDecisionView } from "../views/decision";
import { deciding } from "../views/evidence";
import { reasonWords } from "../views/reasons";
import { campaignParts } from "./campaigns";
import { budgetPositionOf, executableOf } from "./execution-plan";
import { spotHistory } from "./spot-outcomes";

const unresolvedView = ({ spotCode, reason }: UnresolvedRequirement) => ({
  spotCode,
  reasonCode: reason.kind,
  reason: reasonWords(reason),
});

function requirement(
  parts: CampaignParts,
  { spot }: SpotWithScans,
  unresolved: readonly UnresolvedRequirement[],
): GoalRequirementView {
  const tasks = parts.tasks.map(({ task }) => task);
  const deadline = parts.campaign.deadline.toISOString();
  const history = spotHistory(spot, tasks, parts.evidence);
  const own = tasks.filter((task) => task.spotId === spot.id);
  const gap = unresolved.find((item) => item.spotCode === spot.code);
  return {
    spotCode: spot.code,
    name: spot.name,
    status: spotOutcome(history, deadline),
    reasonCode: gap?.reason.kind ?? null,
    reason: gap === undefined ? null : reasonWords(gap.reason),
    attempts: own.length,
    openTaskKey: own.find((task) => isOpenTaskStatus(task.status))?.idempotencyKey ?? null,
    latestEvidenceId: deciding(parts.evidence.filter((row) => row.spotId === spot.id))?.id ?? null,
    passedAt: passedAt(history, deadline),
  };
}

export async function goalState(db: Db, campaignId: string, now: Date): Promise<GoalStateView> {
  const parts = await campaignParts(db, campaignId);
  const target = executableOf(parts);
  const goal = evaluateCampaign(parts, target, now);
  const budget = target.lock.budget;
  const position = budgetPositionOf(parts, budget);
  const decision = await latestDecision(db, campaignId);
  return {
    campaignId,
    status: parts.campaign.status,
    evaluatedAt: now.toISOString(),
    deadline: target.lock.deadline,
    minutesToDeadline: goal.minutesToDeadline,
    passed: goal.passedSpotCodes.length,
    required: goal.requiredSpotCodes.length,
    requirements: parts.spots.map((spot) => requirement(parts, spot, goal.unresolved)),
    unresolved: goal.unresolved.map(unresolvedView),
    approvedBudget: toWireMoney(budget),
    confirmedSpend: toWireMoney(confirmedSpend(position.expenses, budget.currency)),
    committedSpend: toWireMoney(position.committedOpenSpend),
    remainingBudget: toWireMoney(remainingBudget(position)),
    completedAt: parts.campaign.completedAt?.toISOString() ?? null,
    latestDecision: decision === null ? null : toDecisionView(decision, budget.currency),
  };
}
