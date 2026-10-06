import type {
  EvidenceFailure,
  EvidenceVerdict,
  ExecutorAdapter,
  Money,
  PhysicalTaskType,
} from "@datum/core";

interface TaskSubject {
  taskId: string;
  type: PhysicalTaskType;
  spotCode: string | null;
}

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
  | { type: "TASK_COMPLETED"; payload: TaskSubject & { runnerName: string } }
  | { type: "TASK_CANCELLED"; payload: TaskSubject }
  | {
      type: "APPROVAL_REQUESTED";
      payload: { reason: "OVER_BUDGET"; estimated: Money; budget: Money; shortfall: Money };
    }
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
