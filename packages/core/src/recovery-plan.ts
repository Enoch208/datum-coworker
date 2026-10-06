import type { IsoTimestamp, Money, SpotCode } from "./contract";
import { multiplyMoney } from "./money";
import { recoveryKey } from "./recovery";
import type {
  AcceptedAction,
  RemediationAction,
  RemediationGaps,
  RemediationPlan,
  RemediationRejection,
  RemediationVerdict,
} from "./remediation";

export interface RecoveryTerms {
  assetVersion: number;
  ratePerSpot: Money;
}

export const pricedAction = (
  spotCodes: readonly SpotCode[],
  dueBy: IsoTimestamp,
  terms: RecoveryTerms,
): RemediationAction => ({
  spotCodes,
  assetVersion: terms.assetVersion,
  publicCopy: null,
  estimatedCost: multiplyMoney(terms.ratePerSpot, spotCodes.length),
  dueBy,
});

export const standardRecoveryPlan = (
  gaps: RemediationGaps,
  deadline: IsoTimestamp,
  terms: RecoveryTerms,
): RemediationPlan => ({
  actions: gaps.missingSpots.map(({ spotCode }) => pricedAction([spotCode], deadline, terms)),
});

export interface RecoveryTask {
  spotCode: SpotCode;
  attempt: number;
  idempotencyKey: string;
}

export interface ChosenRecovery {
  idempotencyKey: string;
  spotCodes: SpotCode[];
  tasks: RecoveryTask[];
  estimatedCost: Money;
  dueBy: IsoTimestamp;
  runnerNote: string | null;
}

export const chosenRecoveries = (
  campaignId: string,
  accepted: readonly AcceptedAction[],
  runnerNotes: readonly (string | null)[] = [],
): ChosenRecovery[] =>
  accepted.map(({ action, idempotencyKey, coverage }, index) => ({
    idempotencyKey,
    spotCodes: [...action.spotCodes],
    tasks: coverage.map(({ spotCode, attempt }) => ({
      spotCode,
      attempt,
      idempotencyKey: recoveryKey(campaignId, spotCode, attempt),
    })),
    estimatedCost: { ...action.estimatedCost },
    dueBy: action.dueBy,
    runnerNote: runnerNotes[index] ?? null,
  }));

export interface VerdictSummary {
  outcome: RemediationVerdict["outcome"];
  reason: RemediationRejection | null;
  actionIndex: number | null;
  spotCode: SpotCode | null;
  planCost: Money | null;
  shortfall: Money | null;
  revisedMaximum: Money | null;
}

const blankSummary = {
  reason: null,
  actionIndex: null,
  spotCode: null,
  planCost: null,
  shortfall: null,
  revisedMaximum: null,
} as const;

export const summarizeVerdict = (verdict: RemediationVerdict): VerdictSummary => {
  switch (verdict.outcome) {
    case "ACCEPTED":
      return { ...blankSummary, outcome: verdict.outcome, planCost: verdict.planCost };
    case "REJECTED":
      return {
        ...blankSummary,
        outcome: verdict.outcome,
        reason: verdict.reason,
        actionIndex: verdict.actionIndex,
        spotCode: verdict.spotCode,
      };
    case "NEEDS_APPROVAL":
      return {
        ...blankSummary,
        outcome: verdict.outcome,
        planCost: verdict.planCost,
        shortfall: verdict.shortfall,
        revisedMaximum: verdict.revisedMaximum,
      };
    case "EXPIRED":
      return { ...blankSummary, outcome: verdict.outcome };
  }
};
