import type {
  InterventionAction,
  InterventionActor,
  Money,
  RecoveryTask,
  RemediationRejection,
  SpotCode,
  UnresolvedReason,
} from "@datum/core";

export type RecoverySource = "MODEL" | "FALLBACK";

export type FallbackCause =
  | { kind: "REJECTED"; reason: RemediationRejection; spotCode: SpotCode | null }
  | { kind: "PLANNER_FAILED"; code: string; detail: string }
  | { kind: "NO_PLANNER" };

export interface RecoveryOverBudget {
  reason: "RECOVERY_OVER_BUDGET";
  spotCodes: SpotCode[];
  planCost: Money;
  remaining: Money;
  budget: Money;
  shortfall: Money;
  revisedMaximum: Money;
}

export interface ExpenseDisputed {
  reason: "EXPENSE_DISPUTED";
  expenseId: string;
  taskId: string;
  amount: Money;
  explanation: string;
}

export type LoopAuditEvent =
  | {
      type: "INTERVENTION_RECORDED";
      payload: {
        interventionId: string;
        actor: InterventionActor;
        actorName: string;
        action: InterventionAction;
        reason: string;
      };
    }
  | {
      type: "GOAL_EVALUATED";
      payload: {
        passed: number;
        required: number;
        passedSpotCodes: SpotCode[];
        unresolvedSpotCodes: SpotCode[];
        minutesToDeadline: number;
      };
    }
  | { type: "GAP_DETECTED"; payload: { spotCode: SpotCode; reason: UnresolvedReason } }
  | {
      type: "REMEDIATION_PROPOSED";
      payload: {
        round: number;
        model: string;
        actions: { spotCodes: SpotCode[]; dueInMinutes: number }[];
        rationale: string;
      };
    }
  | {
      type: "REMEDIATION_FALLBACK";
      payload: { round: number; cause: FallbackCause; spotCodes: SpotCode[] };
    }
  | {
      type: "RECOVERY_CREATED";
      payload: {
        round: number;
        source: RecoverySource;
        idempotencyKey: string;
        spotCodes: SpotCode[];
        tasks: RecoveryTask[];
        estimatedCost: Money;
        remainingBefore: Money;
        minutesToDeadline: number;
        dueBy: string;
      };
    };
