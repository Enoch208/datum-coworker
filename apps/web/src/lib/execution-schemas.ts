import {
  evidenceFailures,
  evidenceVerdicts,
  executorAdapters,
  expenseStatuses,
  physicalTaskStatuses,
  physicalTaskTypes,
  type AgreedFeeView,
  type EvidenceView,
  type ExpenseView,
  type LedgerView,
  type RunnerInboxView,
  type RunnerTaskView,
  type TaskSummaryView,
} from "@datum/core";
import { z } from "zod";
import { instant, wireMoney } from "./wire-primitives";

export const evidenceSchema: z.ZodType<EvidenceView> = z.object({
  id: z.string(),
  taskId: z.string(),
  spotCode: z.string().nullable(),
  photoUrl: z.string(),
  submittedAt: instant,
  verdict: z.enum(evidenceVerdicts).nullable(),
  failure: z.enum(evidenceFailures).nullable(),
  explanation: z.string(),
  checks: z.object({
    photoReceived: z.boolean(),
    qrDetected: z.boolean(),
    campaignMatches: z.boolean(),
    spotMatches: z.boolean(),
    taskOpen: z.boolean(),
    beforeDeadline: z.boolean(),
  }),
});

export const expenseSchema: z.ZodType<ExpenseView> = z.object({
  id: z.string(),
  taskId: z.string(),
  amount: wireMoney,
  merchant: z.string().nullable(),
  status: z.enum(expenseStatuses),
  receiptUrl: z.string(),
  explanation: z.string(),
});

const agreedFeeSchema: z.ZodType<AgreedFeeView> = z.object({
  id: z.string(),
  taskId: z.string(),
  spotCode: z.string(),
  attempt: z.int().positive(),
  amount: wireMoney,
  merchant: z.string(),
  status: z.enum(expenseStatuses),
  explanation: z.string(),
  recordedAt: instant,
});

export const ledgerSchema: z.ZodType<LedgerView> = z.object({
  approvedBudget: wireMoney,
  confirmedSpend: wireMoney,
  committedSpend: wireMoney,
  remaining: wireMoney,
  expenses: z.array(expenseSchema),
  agreedFees: z.array(agreedFeeSchema).exactOptional(),
});

export const taskSummarySchema: z.ZodType<TaskSummaryView> = z.object({
  id: z.string(),
  type: z.enum(physicalTaskTypes),
  spotCode: z.string().nullable(),
  attempt: z.int().positive(),
  status: z.enum(physicalTaskStatuses),
  adapter: z.enum(executorAdapters),
  dueBy: instant,
  createdAt: instant,
});

export const runnerTaskSchema: z.ZodType<RunnerTaskView> = z.object({
  id: z.string(),
  campaignId: z.string(),
  brandName: z.string(),
  type: z.enum(physicalTaskTypes),
  attempt: z.int().positive(),
  status: z.enum(physicalTaskStatuses),
  spot: z.object({ code: z.string(), name: z.string(), instructions: z.string() }).nullable(),
  instructions: z.string(),
  cards: z.array(z.object({ pngUrl: z.string(), pdfUrl: z.string() })),
  dueBy: instant,
  estimatedCost: wireMoney,
  evidence: z.array(evidenceSchema),
  expense: expenseSchema.nullable(),
});

export const runnerInboxSchema: z.ZodType<RunnerInboxView> = z.object({
  runner: z.object({ id: z.string(), name: z.string() }),
  tasks: z.array(runnerTaskSchema),
});
