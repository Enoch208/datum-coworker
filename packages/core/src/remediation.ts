import { checkBudget, remainingBudget, type BudgetPosition } from "./budget";
import type { IsoTimestamp, Money, PublicCopy, SpotCode } from "./contract";
import type { UnresolvedRequirement } from "./goal";
import { sumMoney } from "./money";
import { actionKey, nextAttempt, type SpotAttempt, type TaskCoverage } from "./recovery";
import { isAfter, minutesUntil } from "./time";

export interface RemediationAction {
  spotCodes: readonly SpotCode[];
  assetVersion: number;
  publicCopy: PublicCopy | null;
  estimatedCost: Money;
  dueBy: IsoTimestamp;
}

export interface RemediationPlan {
  actions: readonly RemediationAction[];
}

export interface RemediationAuthority {
  campaignId: string;
  approvedSpotCodes: readonly SpotCode[];
  unresolved: readonly UnresolvedRequirement[];
  approvedAssetVersion: number;
  approvedCopy: PublicCopy;
  budget: BudgetPosition;
  deadline: IsoTimestamp;
  now: IsoTimestamp;
  tasks: readonly TaskCoverage[];
}

export const remediationRejections = [
  "EMPTY_PLAN",
  "EMPTY_ACTION",
  "ASSET_NOT_APPROVED",
  "COPY_CHANGED",
  "DUE_AFTER_DEADLINE",
  "DUE_BEFORE_NOW",
  "SPOT_NOT_APPROVED",
  "SPOT_REPEATED_IN_PLAN",
  "SPOT_NOT_UNRESOLVED",
  "DUPLICATE_OPEN_TASK",
  "SPOT_HAS_OPEN_TASK",
  "SPOT_LEFT_UNPLANNED",
] as const;
export type RemediationRejection = (typeof remediationRejections)[number];

export interface AcceptedAction {
  action: RemediationAction;
  idempotencyKey: string;
  coverage: SpotAttempt[];
}

export interface RejectedRemediation {
  outcome: "REJECTED";
  reason: RemediationRejection;
  actionIndex: number | null;
  spotCode: SpotCode | null;
}

export type RemediationVerdict =
  | { outcome: "ACCEPTED"; actions: AcceptedAction[]; planCost: Money }
  | RejectedRemediation
  | { outcome: "NEEDS_APPROVAL"; planCost: Money; shortfall: Money; revisedMaximum: Money }
  | { outcome: "EXPIRED" };

export interface RemediationGaps {
  missingSpots: UnresolvedRequirement[];
  remainingBudgetMinor: number;
  minutesToDeadline: number;
  openTasks: string[];
}

const rejected = (
  reason: RemediationRejection,
  actionIndex: number | null,
  spotCode: SpotCode | null,
): RejectedRemediation => ({ outcome: "REJECTED", reason, actionIndex, spotCode });

const openTasks = (authority: RemediationAuthority): TaskCoverage[] =>
  authority.tasks.filter((task) => task.open);

const hasOpenTask = (authority: RemediationAuthority, spotCode: SpotCode): boolean =>
  openTasks(authority).some((task) => task.spotCodes.includes(spotCode));

const sameCopy = (left: PublicCopy, right: PublicCopy): boolean =>
  left.headline === right.headline && left.subcopy === right.subcopy;

const termsRejection = (
  action: RemediationAction,
  authority: RemediationAuthority,
): RemediationRejection | null => {
  if (action.spotCodes.length === 0) return "EMPTY_ACTION";
  if (action.assetVersion !== authority.approvedAssetVersion) return "ASSET_NOT_APPROVED";
  if (action.publicCopy !== null && !sameCopy(action.publicCopy, authority.approvedCopy)) {
    return "COPY_CHANGED";
  }
  if (isAfter(action.dueBy, authority.deadline)) return "DUE_AFTER_DEADLINE";
  if (isAfter(authority.now, action.dueBy)) return "DUE_BEFORE_NOW";
  return null;
};

const spotRejection = (
  spotCode: SpotCode,
  authority: RemediationAuthority,
  planned: ReadonlySet<SpotCode>,
): RemediationRejection | null => {
  if (!authority.approvedSpotCodes.includes(spotCode)) return "SPOT_NOT_APPROVED";
  if (planned.has(spotCode)) return "SPOT_REPEATED_IN_PLAN";
  const unresolved = authority.unresolved.some((requirement) => requirement.spotCode === spotCode);
  return unresolved ? null : "SPOT_NOT_UNRESOLVED";
};

const keyedAction = (
  action: RemediationAction,
  authority: RemediationAuthority,
): AcceptedAction => {
  const coverage = action.spotCodes.map((spotCode) => ({
    spotCode,
    attempt: nextAttempt(authority.tasks, spotCode),
  }));
  return { action, idempotencyKey: actionKey(authority.campaignId, coverage), coverage };
};

const checkAction = (
  action: RemediationAction,
  index: number,
  authority: RemediationAuthority,
  planned: Set<SpotCode>,
): AcceptedAction | RejectedRemediation => {
  const terms = termsRejection(action, authority);
  if (terms !== null) return rejected(terms, index, null);
  for (const spotCode of action.spotCodes) {
    const reason = spotRejection(spotCode, authority, planned);
    if (reason !== null) return rejected(reason, index, spotCode);
    planned.add(spotCode);
  }
  const keyed = keyedAction(action, authority);
  const open = openTasks(authority);
  if (open.some((task) => task.idempotencyKey === keyed.idempotencyKey)) {
    return rejected("DUPLICATE_OPEN_TASK", index, null);
  }
  const busy = action.spotCodes.find((spotCode) => hasOpenTask(authority, spotCode));
  return busy === undefined ? keyed : rejected("SPOT_HAS_OPEN_TASK", index, busy);
};

const budgetVerdict = (
  accepted: AcceptedAction[],
  authority: RemediationAuthority,
): RemediationVerdict => {
  const currency = authority.budget.approvedBudget.currency;
  const planCost = sumMoney(
    accepted.map((keyed) => keyed.action.estimatedCost),
    currency,
  );
  const decision = checkBudget({ ...authority.budget, estimatedActionCost: planCost });
  if (decision.decision === "PROCEED") return { outcome: "ACCEPTED", actions: accepted, planCost };
  const { shortfall, revisedMaximum } = decision;
  return { outcome: "NEEDS_APPROVAL", planCost, shortfall, revisedMaximum };
};

const unplannedSpot = (
  authority: RemediationAuthority,
  planned: ReadonlySet<SpotCode>,
): SpotCode | undefined =>
  authority.unresolved
    .map((requirement) => requirement.spotCode)
    .find((spotCode) => !planned.has(spotCode) && !hasOpenTask(authority, spotCode));

export const validateRemediation = (
  plan: RemediationPlan,
  authority: RemediationAuthority,
): RemediationVerdict => {
  if (isAfter(authority.now, authority.deadline)) return { outcome: "EXPIRED" };
  if (plan.actions.length === 0) return rejected("EMPTY_PLAN", null, null);
  const planned = new Set<SpotCode>();
  const accepted: AcceptedAction[] = [];
  for (const [index, action] of plan.actions.entries()) {
    const result = checkAction(action, index, authority, planned);
    if ("outcome" in result) return result;
    accepted.push(result);
  }
  const unplanned = unplannedSpot(authority, planned);
  if (unplanned !== undefined) return rejected("SPOT_LEFT_UNPLANNED", null, unplanned);
  return budgetVerdict(accepted, authority);
};

export const remediationGaps = (authority: RemediationAuthority): RemediationGaps => ({
  missingSpots: authority.unresolved
    .filter((requirement) => !hasOpenTask(authority, requirement.spotCode))
    .map(({ spotCode, reason }) => ({ spotCode, reason })),
  remainingBudgetMinor: remainingBudget(authority.budget).amountMinor,
  minutesToDeadline: minutesUntil(authority.now, authority.deadline),
  openTasks: openTasks(authority).map((task) => task.idempotencyKey),
});
