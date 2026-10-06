import {
  currencies,
  evidenceFailures,
  evidenceVerdicts,
  executorAdapters,
  expenseStatuses,
  isMoneyText,
  physicalTaskStatuses,
  physicalTaskTypes,
  type EvidenceView,
  type ExpenseView,
  type LedgerView,
  type RunnerInboxView,
  type RunnerTaskView,
  type TaskSummaryView,
  type WireMoney,
} from "@datum/core";
import { z } from "zod";

const instant = z.iso.datetime({ offset: true });

const wireMoney: z.ZodType<WireMoney> = z.object({
  amount: z.string().refine(isMoneyText, "Not a decimal money amount"),
  currency: z.enum(currencies),
});

export const evidenceSchema: z.ZodType<EvidenceView> = z.object({
  id: z.string(),
  taskId: z.string(),
  spotCode: z.string().nullable(),
  photoUrl: z.string(),
  submittedAt: instant,
  verdict: z.enum(evidenceVerdicts).nullable(),
  failure: z.enum(evidenceFailures).nullable(),
  explanation: z.string(),
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

export const ledgerSchema: z.ZodType<LedgerView> = z.object({
  approvedBudget: wireMoney,
  confirmedSpend: wireMoney,
  committedSpend: wireMoney,
  remaining: wireMoney,
  expenses: z.array(expenseSchema),
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
