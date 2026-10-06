import {
  campaignStatuses,
  remediationOutcomes,
  remediationRejections,
  spotOutcomes,
  type GoalReasonCode,
  type GoalStateView,
  type RecoveryTaskKeyView,
  type RemediationDecisionView,
  type RemediationVerdictView,
  type UnresolvedRequirementView,
} from "@datum/core";
import { z } from "zod";
import { instant, wireMoney } from "./wire-primitives";

export const reasonCodeLabels: Record<GoalReasonCode, string> = {
  NOT_COMMISSIONED: "Not commissioned",
  NO_EVIDENCE_YET: "No photo yet",
  EVIDENCE_FAILED: "Photo failed",
  CLOSED_WITHOUT_PASS: "Closed without a pass",
  TASK_ENDED: "Task ended",
};

const reasonCode = z.custom<GoalReasonCode>(
  (value) => typeof value === "string" && Object.hasOwn(reasonCodeLabels, value),
  "Not a goal reason code",
);

const unresolved: z.ZodType<UnresolvedRequirementView> = z.object({
  spotCode: z.string(),
  reasonCode,
  reason: z.string(),
});

const nullableMoney = wireMoney.nullable();

const verdict: z.ZodType<RemediationVerdictView> = z.object({
  outcome: z.enum(remediationOutcomes),
  reason: z.enum(remediationRejections).nullable(),
  actionIndex: z.int().nullable(),
  spotCode: z.string().nullable(),
  planCost: nullableMoney,
  shortfall: nullableMoney,
  revisedMaximum: nullableMoney,
});

export const recoveryTaskKey: z.ZodType<RecoveryTaskKeyView> = z.object({
  spotCode: z.string(),
  attempt: z.int().positive(),
  idempotencyKey: z.string(),
});

const decision: z.ZodType<RemediationDecisionView> = z.object({
  round: z.int(),
  decidedAt: instant,
  appliedAt: instant.nullable(),
  gaps: z.object({
    missingSpots: z.array(unresolved),
    remainingBudget: wireMoney,
    minutesToDeadline: z.int(),
    openTasks: z.array(z.string()),
  }),
  planner: z.object({
    model: z.string().nullable(),
    proposal: z
      .object({
        actions: z.array(
          z.object({
            spotCodes: z.array(z.string()),
            dueInMinutes: z.int(),
            runnerNote: z.string(),
          }),
        ),
        rationale: z.string(),
      })
      .nullable(),
    failure: z.object({ code: z.string(), detail: z.string() }).nullable(),
    verdict: verdict.nullable(),
  }),
  fallbackUsed: z.boolean(),
  verdict,
  actions: z.array(
    z.object({
      idempotencyKey: z.string(),
      spotCodes: z.array(z.string()),
      tasks: z.array(recoveryTaskKey),
      estimatedCost: wireMoney,
      dueBy: instant,
      runnerNote: z.string().nullable(),
    }),
  ),
});

export const goalStateSchema: z.ZodType<GoalStateView> = z.object({
  campaignId: z.string(),
  status: z.enum(campaignStatuses),
  evaluatedAt: instant,
  deadline: instant,
  minutesToDeadline: z.int(),
  passed: z.int().nonnegative(),
  required: z.int().nonnegative(),
  requirements: z.array(
    z.object({
      spotCode: z.string(),
      name: z.string(),
      status: z.enum(spotOutcomes),
      reasonCode: reasonCode.nullable(),
      reason: z.string().nullable(),
      attempts: z.int().nonnegative(),
      openTaskKey: z.string().nullable(),
      latestEvidenceId: z.string().nullable(),
      passedAt: instant.nullable(),
    }),
  ),
  unresolved: z.array(unresolved),
  approvedBudget: wireMoney,
  confirmedSpend: wireMoney,
  committedSpend: wireMoney,
  remainingBudget: wireMoney,
  completedAt: instant.nullable(),
  latestDecision: decision.nullable(),
});
