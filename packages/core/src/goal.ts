import { confirmedSpend, type LedgerExpense } from "./budget";
import {
  openTaskStatuses,
  type EvidenceFailure,
  type EvidenceVerdict,
  type GoalLoopStopStatus,
  type IsoTimestamp,
  type Money,
  type PhysicalTaskStatus,
  type SpotCode,
  type SpotOutcome,
} from "./contract";
import { compareMoney } from "./money";
import { isAfter, minutesUntil, toEpochMs } from "./time";

export interface TimedVerdict {
  attempt: number;
  verdict: EvidenceVerdict;
  failure: EvidenceFailure | null;
  submittedAt: IsoTimestamp;
}

export type AttemptState = "OPEN" | "COMPLETED" | "EXPIRED" | "CANCELLED";

export interface SpotAttemptState {
  attempt: number;
  state: AttemptState;
}

export interface SpotEvidenceHistory {
  spotCode: SpotCode;
  evidence: readonly TimedVerdict[];
  attempts: readonly SpotAttemptState[];
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
  | { kind: "NOT_COMMISSIONED" }
  | { kind: "NO_EVIDENCE_YET" }
  | { kind: "EVIDENCE_FAILED"; failure: EvidenceFailure }
  | { kind: "CLOSED_WITHOUT_PASS"; lastFailure: EvidenceFailure | null }
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
  spendSettled: boolean;
  completedAt: IsoTimestamp | null;
  complete: boolean;
  stop: GoalLoopStopStatus | null;
}

const openStatuses: ReadonlySet<PhysicalTaskStatus> = new Set(openTaskStatuses);

export const attemptStateOf = (status: PhysicalTaskStatus): AttemptState => {
  if (openStatuses.has(status)) return "OPEN";
  if (status === "COMPLETED" || status === "EXPIRED" || status === "CANCELLED") return status;
  throw new RangeError(`Task status ${status} is neither open nor closed`);
};

const byTime = (left: TimedVerdict, right: TimedVerdict): number =>
  toEpochMs(left.submittedAt) - toEpochMs(right.submittedAt);

export const passedAt = (
  history: SpotEvidenceHistory,
  deadline: IsoTimestamp,
  attempt: number | null = null,
): IsoTimestamp | null =>
  history.evidence
    .filter((item) => attempt === null || item.attempt === attempt)
    .filter((item) => item.verdict === "PASS" && !isAfter(item.submittedAt, deadline))
    .sort(byTime)
    .at(0)?.submittedAt ?? null;

const latestAttempt = (history: SpotEvidenceHistory): SpotAttemptState | null =>
  history.attempts.reduce<SpotAttemptState | null>(
    (latest, attempt) => (latest === null || attempt.attempt > latest.attempt ? attempt : latest),
    null,
  );

const lastFailureOf = (history: SpotEvidenceHistory, attempt: number): EvidenceFailure | null =>
  [...history.evidence]
    .filter((item) => item.attempt === attempt)
    .sort(byTime)
    .reduce<EvidenceFailure | null>((latest, item) => item.failure ?? latest, null);

const isTaskEndFailure = (failure: EvidenceFailure): failure is TaskEndFailure =>
  failure === "EXECUTOR_CANCELLED" || failure === "TASK_EXPIRED";

const openReason = (failure: EvidenceFailure | null): UnresolvedReason => {
  if (failure === null) return { kind: "NO_EVIDENCE_YET" };
  if (isTaskEndFailure(failure)) return { kind: "TASK_ENDED", failure };
  return { kind: "EVIDENCE_FAILED", failure };
};

export const unresolvedReason = (history: SpotEvidenceHistory): UnresolvedReason => {
  const latest = latestAttempt(history);
  if (latest === null) return { kind: "NOT_COMMISSIONED" };
  const lastFailure = lastFailureOf(history, latest.attempt);
  switch (latest.state) {
    case "OPEN":
      return openReason(lastFailure);
    case "COMPLETED":
      return { kind: "CLOSED_WITHOUT_PASS", lastFailure };
    case "EXPIRED":
      return { kind: "TASK_ENDED", failure: "TASK_EXPIRED" };
    case "CANCELLED":
      return { kind: "TASK_ENDED", failure: "EXECUTOR_CANCELLED" };
  }
};

export const isMissed = (reason: UnresolvedReason): boolean =>
  reason.kind === "CLOSED_WITHOUT_PASS" || reason.kind === "TASK_ENDED";

export const spotOutcome = (history: SpotEvidenceHistory, deadline: IsoTimestamp): SpotOutcome => {
  if (passedAt(history, deadline) !== null) return "PASS";
  return isMissed(unresolvedReason(history)) ? "MISS" : "PENDING";
};

export const firstPassOutcome = (
  history: SpotEvidenceHistory,
  deadline: IsoTimestamp,
): SpotOutcome => {
  if (passedAt(history, deadline, 1) !== null) return "PASS";
  const first = history.attempts.find((attempt) => attempt.attempt === 1);
  return first === undefined || first.state === "OPEN" ? "PENDING" : "MISS";
};

const latestOf = (times: readonly IsoTimestamp[]): IsoTimestamp | null =>
  times.reduce<IsoTimestamp | null>(
    (latest, time) => (latest === null || isAfter(time, latest) ? time : latest),
    null,
  );

const completionTime = (
  spots: readonly SpotEvidenceHistory[],
  deadline: IsoTimestamp,
): IsoTimestamp | null => {
  const times = spots.map((history) => passedAt(history, deadline));
  if (spots.length === 0 || times.some((time) => time === null)) return null;
  return latestOf(times.filter((time): time is IsoTimestamp => time !== null));
};

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
  const passed = input.spots.filter((history) => passedAt(history, input.deadline) !== null);
  const unresolved = input.spots
    .filter((history) => passedAt(history, input.deadline) === null)
    .map((history) => ({ spotCode: history.spotCode, reason: unresolvedReason(history) }));
  const spend = confirmedSpend(input.expenses, input.approvedBudget.currency);
  const beforeDeadline = !isAfter(input.now, input.deadline);
  const withinBudget = compareMoney(spend, input.approvedBudget) <= 0;
  const spendSettled = input.expenses.every((expense) => expense.status === "CONFIRMED");
  const completedAt = completionTime(input.spots, input.deadline);
  const complete = input.approvalValid && withinBudget && spendSettled && completedAt !== null;
  return {
    requiredSpotCodes: input.spots.map((history) => history.spotCode),
    passedSpotCodes: passed.map((history) => history.spotCode),
    missingSpotCodes: unresolved.map((requirement) => requirement.spotCode),
    unresolved,
    approvalValid: input.approvalValid,
    beforeDeadline,
    minutesToDeadline: minutesUntil(input.now, input.deadline),
    confirmedSpend: spend,
    withinBudget,
    spendSettled,
    completedAt: complete ? completedAt : null,
    complete,
    stop: stopStatus({
      complete,
      beforeDeadline,
      approvalValid: input.approvalValid,
      withinBudget,
    }),
  };
};
