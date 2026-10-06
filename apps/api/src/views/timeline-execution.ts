import {
  evidenceFailures,
  evidenceVerdicts,
  formatMoney,
  physicalTaskTypes,
  subtractMoney,
} from "@datum/core";
import { z } from "zod";
import { describe, moneyPayload as money, plural, type Describers } from "./describe";
import { recoveryOverBudget, recoveryOverBudgetWords } from "./timeline-loop";

const task = z.object({
  taskId: z.string(),
  type: z.enum(physicalTaskTypes),
  spotCode: z.string().nullable(),
});

const taskName = (subject: z.output<typeof task>): string =>
  subject.spotCode === null ? "the print run" : `the Spot ${subject.spotCode} placement`;

const decided = z.object({ amount: money, explanation: z.string() });

const closedByDatum = task.extend({ closedBy: z.literal("DATUM"), evidenceId: z.string() });

const budgetFacts = z.object({
  tasks: z.int(),
  estimated: money,
  confirmedSpend: money,
  committedSpend: money,
  budget: money,
});

const planOverBudget = z.object({
  reason: z.literal("OVER_BUDGET"),
  estimated: money,
  budget: money,
  shortfall: money,
});

const placementsOverBudget = budgetFacts.extend({
  reason: z.literal("PLACEMENTS_OVER_BUDGET"),
  shortfall: money,
});

const approvalRequest = z.discriminatedUnion("reason", [
  planOverBudget,
  placementsOverBudget,
  recoveryOverBudget,
]);

const spare = (facts: z.output<typeof budgetFacts>) =>
  formatMoney(
    subtractMoney(
      subtractMoney(subtractMoney(facts.budget, facts.confirmedSpend), facts.committedSpend),
      facts.estimated,
    ),
  );

const budgetCheckSummary = (
  p: z.output<typeof budgetFacts> & { stage: "PLAN" | "PLACEMENTS" },
): string =>
  p.stage === "PLAN"
    ? `Checked the approved plan's ${formatMoney(p.estimated)} estimate against the ${formatMoney(p.budget)} budget: it fits, so the print run goes first and the placements follow once its spend is confirmed`
    : `Print spend is confirmed at ${formatMoney(p.confirmedSpend)}; the ${plural(p.tasks, "placement")} need ${formatMoney(p.estimated)}, which fits the ${formatMoney(p.budget)} budget with ${spare(p)} to spare, so they go out now`;

const approvalSummary = (p: z.output<typeof approvalRequest>): string => {
  if (p.reason === "RECOVERY_OVER_BUDGET") return recoveryOverBudgetWords(p);
  return p.reason === "OVER_BUDGET"
    ? `Stopped before commissioning anything: the approved plan needs ${formatMoney(p.estimated)}, ${formatMoney(p.shortfall)} more than the ${formatMoney(p.budget)} budget, so it needs the customer's approval`
    : `Stopped before sending the placements: ${formatMoney(p.confirmedSpend)} is confirmed for printing and the ${plural(p.tasks, "placement")} need ${formatMoney(p.estimated)}, ${formatMoney(p.shortfall)} over the ${formatMoney(p.budget)} budget, so they need the customer's approval`;
};

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
  TASK_COMPLETED: (payload) => {
    const closed = closedByDatum.safeParse(payload);
    if (closed.success) {
      return {
        actor: "DATUM_RULES",
        summary: `Closed ${taskName(closed.data)}: its photo passed, so the placement is accepted and its agreed fee is owed`,
      };
    }
    return describe(
      task.extend({ runnerName: z.string() }),
      "RUNNER",
      (p) => `${p.runnerName} marked ${taskName(p)} done`,
    )(payload);
  },
  TASK_CANCELLED: describe(task, "DATUM_RULES", (p) => `Cancelled ${taskName(p)}`),
  TASK_EXPIRED: describe(
    task.extend({ attempt: z.int(), released: money }),
    "DATUM_RULES",
    (p) =>
      `Closed ${taskName(p)} (attempt ${String(p.attempt)}) as expired: it passed its due time${p.released.amountMinor > 0 ? `, so its ${formatMoney(p.released)} hold on the budget is released` : ""}`,
  ),
  BUDGET_CHECKED: describe(
    budgetFacts.extend({ stage: z.enum(["PLAN", "PLACEMENTS"]) }),
    "DATUM_RULES",
    budgetCheckSummary,
  ),
  APPROVAL_REQUESTED: describe(approvalRequest, "DATUM_RULES", approvalSummary),
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
