import { evidenceFailures, evidenceVerdicts, formatMoney, physicalTaskTypes } from "@datum/core";
import { z } from "zod";
import { describe, moneyPayload as money, type Describers } from "./describe";

const task = z.object({
  taskId: z.string(),
  type: z.enum(physicalTaskTypes),
  spotCode: z.string().nullable(),
});

const taskName = (subject: z.output<typeof task>): string =>
  subject.spotCode === null ? "the print run" : `the Spot ${subject.spotCode} placement`;

const decided = z.object({ amount: money, explanation: z.string() });

export const executionDescribers: Describers = {
  TASK_CREATED: describe(
    task.extend({ attempt: z.int(), copies: z.int().nullable(), estimatedCost: money }),
    "DATUM_RULES",
    (p) =>
      `Commissioned ${taskName(p)}${p.copies === null ? "" : ` of ${String(p.copies)} copies`} (attempt ${String(p.attempt)}), holding ${formatMoney(p.estimatedCost)} of the budget`,
  ),
  TASK_DISPATCHED: describe(
    task.extend({ runnerName: z.string() }),
    "DATUM_RULES",
    (p) => `Sent ${taskName(p)} to ${p.runnerName}, a local enrolled runner`,
  ),
  TASK_ACCEPTED: describe(
    task.extend({ runnerName: z.string() }),
    "RUNNER",
    (p) => `${p.runnerName} accepted ${taskName(p)}`,
  ),
  TASK_COMPLETED: describe(
    task.extend({ runnerName: z.string() }),
    "RUNNER",
    (p) => `${p.runnerName} marked ${taskName(p)} done`,
  ),
  TASK_CANCELLED: describe(task, "DATUM_RULES", (p) => `Cancelled ${taskName(p)}`),
  APPROVAL_REQUESTED: describe(
    z.object({ estimated: money, budget: money, shortfall: money }),
    "DATUM_RULES",
    (p) =>
      `Stopped before commissioning anything: the approved plan needs ${formatMoney(p.estimated)}, ${formatMoney(p.shortfall)} more than the ${formatMoney(p.budget)} budget, so it needs the customer's approval`,
  ),
  EVIDENCE_RECEIVED: describe(
    z.object({ spotCode: z.string(), runnerName: z.string() }),
    "RUNNER",
    (p) => `${p.runnerName} uploaded a photo for Spot ${p.spotCode}`,
  ),
  EVIDENCE_EVALUATED: describe(
    z.object({
      spotCode: z.string(),
      verdict: z.enum(evidenceVerdicts),
      failure: z.enum(evidenceFailures).nullable(),
      explanation: z.string(),
    }),
    "DATUM_RULES",
    (p) =>
      `Spot ${p.spotCode} ${p.verdict}${p.failure === null ? "" : ` (${p.failure})`}: ${p.explanation}`,
  ),
  EXPENSE_SUBMITTED: describe(
    z.object({ amount: money, merchant: z.string().nullable(), runnerName: z.string() }),
    "RUNNER",
    (p) =>
      `${p.runnerName} submitted a ${formatMoney(p.amount)} receipt${p.merchant === null ? "" : ` from ${p.merchant}`}`,
  ),
  EXPENSE_CONFIRMED: describe(
    decided,
    "DATUM_RULES",
    (p) => `Confirmed ${formatMoney(p.amount)} of spend: ${p.explanation}`,
  ),
  EXPENSE_DISPUTED: describe(
    decided,
    "DATUM_RULES",
    (p) => `Held ${formatMoney(p.amount)} for review: ${p.explanation}`,
  ),
};
