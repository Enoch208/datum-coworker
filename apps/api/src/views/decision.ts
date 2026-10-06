import {
  toWireMoney,
  type Currency,
  type RemediationDecisionView,
  type RemediationVerdictView,
  type VerdictSummary,
} from "@datum/core";
import type { RemediationDecisionRow } from "@datum/db";
import { reasonWords } from "./reasons";

const wireOrNull = (money: VerdictSummary["planCost"]) =>
  money === null ? null : toWireMoney(money);

const toVerdictView = (verdict: VerdictSummary): RemediationVerdictView => ({
  outcome: verdict.outcome,
  reason: verdict.reason,
  actionIndex: verdict.actionIndex,
  spotCode: verdict.spotCode,
  planCost: wireOrNull(verdict.planCost),
  shortfall: wireOrNull(verdict.shortfall),
  revisedMaximum: wireOrNull(verdict.revisedMaximum),
});

export function toDecisionView(
  row: RemediationDecisionRow,
  currency: Currency,
): RemediationDecisionView {
  return {
    round: row.round,
    decidedAt: row.createdAt.toISOString(),
    appliedAt: row.appliedAt?.toISOString() ?? null,
    gaps: {
      missingSpots: row.gaps.missingSpots.map(({ spotCode, reason }) => ({
        spotCode,
        reasonCode: reason.kind,
        reason: reasonWords(reason),
      })),
      remainingBudget: toWireMoney({ amountMinor: row.gaps.remainingBudgetMinor, currency }),
      minutesToDeadline: row.gaps.minutesToDeadline,
      openTasks: row.gaps.openTasks,
    },
    planner: {
      model: row.plannerModel,
      proposal: row.proposal,
      failure: row.plannerFailure,
      verdict: row.proposalVerdict === null ? null : toVerdictView(row.proposalVerdict),
    },
    fallbackUsed: row.fallbackUsed,
    verdict: toVerdictView(row.verdict),
    actions: row.actions.map((action) => ({
      ...action,
      estimatedCost: toWireMoney(action.estimatedCost),
    })),
  };
}
