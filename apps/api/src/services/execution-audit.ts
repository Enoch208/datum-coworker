import type {
  EvidenceFailure,
  EvidenceVerdict,
  ExecutorAdapter,
  Money,
  PhysicalTaskType,
} from "@datum/core";
import type { ExpenseDisputed, RecoveryOverBudget } from "./loop-audit";

interface TaskSubject {
  taskId: string;
  type: PhysicalTaskType;
  spotCode: string | null;
}

export type BudgetStage = "PLAN" | "PRINT_RETRY" | "PLACEMENTS";

export interface BudgetFacts {
  stage: BudgetStage;
  tasks: number;
  estimated: Money;
  confirmedSpend: Money;
  committedSpend: Money;
  budget: Money;
}

export type ApprovalRequest =
  | { reason: "OVER_BUDGET"; estimated: Money; budget: Money; shortfall: Money }
  | (Omit<BudgetFacts, "stage"> & {
      reason: "PLACEMENTS_OVER_BUDGET" | "REPRINT_OVER_BUDGET";
      shortfall: Money;
    })
  | RecoveryOverBudget
  | ExpenseDisputed;

export type RunnerUnavailable = Omit<TaskSubject, "taskId"> & { attempt: number } & (
    | { kind: "LINK_CLOSED"; taskId: string; runnerName: string }
    | { kind: "NONE_AVAILABLE"; idempotencyKey: string; dueBy: string }
  );

interface ExpenseDecided {
  expenseId: string;
  taskId: string;
  amount: Money;
  explanation: string;
}

export type ExecutionAuditEvent =
  | {
      type: "TASK_CREATED";
      payload: TaskSubject & {
        attempt: number;
        idempotencyKey: string;
        adapter: ExecutorAdapter;
        copies: number | null;
        estimatedCost: Money;
      };
    }
  | {
      type: "TASK_DISPATCHED";
      payload: TaskSubject & { adapter: ExecutorAdapter; runnerId: string; runnerName: string };
    }
  | { type: "TASK_ACCEPTED"; payload: TaskSubject & { runnerName: string } }
  | {
      type: "TASK_COMPLETED";
      payload: TaskSubject & ({ runnerName: string } | { closedBy: "DATUM"; proofId: string });
    }
  | { type: "TASK_CANCELLED"; payload: TaskSubject }
  | { type: "TASK_EXPIRED"; payload: TaskSubject & { attempt: number; released: Money } }
  | { type: "RUNNER_UNAVAILABLE"; payload: RunnerUnavailable }
  | { type: "BUDGET_CHECKED"; payload: BudgetFacts }
  | { type: "APPROVAL_REQUESTED"; payload: ApprovalRequest }
  | {
      type: "EVIDENCE_RECEIVED";
      payload: { evidenceId: string; taskId: string; spotCode: string; runnerName: string };
    }
  | {
      type: "EVIDENCE_EVALUATED";
      payload: {
        evidenceId: string;
        taskId: string;
        spotCode: string;
        verdict: EvidenceVerdict;
        failure: EvidenceFailure | null;
        explanation: string;
      };
    }
  | {
      type: "EXPENSE_SUBMITTED";
      payload: {
        expenseId: string;
        taskId: string;
        amount: Money;
        merchant: string | null;
        runnerName: string;
      };
    }
  | { type: "EXPENSE_CONFIRMED"; payload: ExpenseDecided }
  | { type: "EXPENSE_DISPUTED"; payload: ExpenseDecided };
