import { confirmedSpend, type LedgerExpense } from "./budget";
import type {
  EvidenceEvaluation,
  EvidenceFailure,
  GoalLoopStopStatus,
  IsoTimestamp,
  Money,
  SpotCode,
} from "./contract";
import { compareMoney } from "./money";
import { isAfter, minutesUntil } from "./time";

export interface SpotEvidenceHistory {
  spotCode: SpotCode;
  evaluations: readonly EvidenceEvaluation[];
}

export interface GoalInput {
  spots: readonly SpotEvidenceHistory[];
  approvalValid: boolean;
  now: IsoTimestamp;
  deadline: IsoTimestamp;
  approvedBudget: Money;
  expenses: readonly LedgerExpense[];
}

export type TaskEndFailure = Extract<EvidenceFailure, "EXECUTOR_CANCELLED" | "TASK_EXPIRED">;

export type UnresolvedReason =
  | { kind: "NO_EVIDENCE_YET" }
  | { kind: "EVIDENCE_FAILED"; failure: Exclude<EvidenceFailure, TaskEndFailure> }
  | { kind: "TASK_ENDED"; failure: TaskEndFailure };

export interface UnresolvedRequirement {
  spotCode: SpotCode;
  reason: UnresolvedReason;
}

export interface GoalEvaluation {
  requiredSpotCodes: SpotCode[];
  passedSpotCodes: SpotCode[];
  missingSpotCodes: SpotCode[];
  unresolved: UnresolvedRequirement[];
  approvalValid: boolean;
  beforeDeadline: boolean;
  minutesToDeadline: number;
  confirmedSpend: Money;
  withinBudget: boolean;
  complete: boolean;
  stop: GoalLoopStopStatus | null;
}

const hasPassed = (history: SpotEvidenceHistory): boolean =>
  history.evaluations.some((evaluation) => evaluation.verdict === "PASS");

const latestFailure = (history: SpotEvidenceHistory): EvidenceFailure | null =>
  history.evaluations.reduce<EvidenceFailure | null>(
    (latest, evaluation) => evaluation.failure ?? latest,
    null,
  );

const isTaskEndFailure = (failure: EvidenceFailure): failure is TaskEndFailure =>
  failure === "EXECUTOR_CANCELLED" || failure === "TASK_EXPIRED";

const reasonFor = (history: SpotEvidenceHistory): UnresolvedReason => {
  const failure = latestFailure(history);
  if (failure === null) return { kind: "NO_EVIDENCE_YET" };
  if (isTaskEndFailure(failure)) return { kind: "TASK_ENDED", failure };
  return { kind: "EVIDENCE_FAILED", failure };
};

const unresolvedRequirements = (spots: readonly SpotEvidenceHistory[]): UnresolvedRequirement[] =>
  spots
    .filter((history) => !hasPassed(history))
    .map((history) => ({ spotCode: history.spotCode, reason: reasonFor(history) }));

interface StopFacts {
  complete: boolean;
  beforeDeadline: boolean;
  approvalValid: boolean;
  withinBudget: boolean;
}

const stopStatus = (facts: StopFacts): GoalLoopStopStatus | null => {
  if (facts.complete) return "COMPLETED";
  if (!facts.beforeDeadline) return "EXPIRED_INCOMPLETE";
  if (!facts.approvalValid || !facts.withinBudget) return "NEEDS_APPROVAL";
  return null;
};

export const evaluateGoal = (input: GoalInput): GoalEvaluation => {
  const unresolved = unresolvedRequirements(input.spots);
  const spend = confirmedSpend(input.expenses, input.approvedBudget.currency);
  const beforeDeadline = !isAfter(input.now, input.deadline);
  const withinBudget = compareMoney(spend, input.approvedBudget) <= 0;
  const everySpotPassed = input.spots.length > 0 && unresolved.length === 0;
  const complete = input.approvalValid && beforeDeadline && withinBudget && everySpotPassed;
  return {
    requiredSpotCodes: input.spots.map((history) => history.spotCode),
    passedSpotCodes: input.spots.filter(hasPassed).map((history) => history.spotCode),
    missingSpotCodes: unresolved.map((requirement) => requirement.spotCode),
    unresolved,
    approvalValid: input.approvalValid,
    beforeDeadline,
    minutesToDeadline: minutesUntil(input.now, input.deadline),
    confirmedSpend: spend,
    withinBudget,
    complete,
    stop: stopStatus({
      complete,
      beforeDeadline,
      approvalValid: input.approvalValid,
      withinBudget,
    }),
  };
};
