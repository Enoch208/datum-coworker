import { formatMoney, subtractMoney } from "@datum/core";
import { z } from "zod";
import { describe, moneyPayload as money, plural, type Describers } from "./describe";
import { recoveryOverBudget, recoveryOverBudgetWords } from "./timeline-loop";

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

const stageOverBudget = budgetFacts.extend({
  reason: z.enum(["PLACEMENTS_OVER_BUDGET", "REPRINT_OVER_BUDGET"]),
  shortfall: money,
});

const expenseDisputed = z.object({
  reason: z.literal("EXPENSE_DISPUTED"),
  amount: money,
  explanation: z.string(),
});

const approvalRequest = z.union([
  planOverBudget,
  stageOverBudget,
  recoveryOverBudget,
  expenseDisputed,
]);

const spare = (facts: z.output<typeof budgetFacts>) =>
  formatMoney(
    subtractMoney(
      subtractMoney(subtractMoney(facts.budget, facts.confirmedSpend), facts.committedSpend),
      facts.estimated,
    ),
  );

const budgetCheck = budgetFacts.extend({ stage: z.enum(["PLAN", "PRINT_RETRY", "PLACEMENTS"]) });

const budgetCheckSummary = (p: z.output<typeof budgetCheck>): string => {
  switch (p.stage) {
    case "PLAN":
      return `Checked the approved plan's ${formatMoney(p.estimated)} estimate against the ${formatMoney(p.budget)} budget: it fits, so the print run goes first and the placements follow once its spend is confirmed`;
    case "PRINT_RETRY":
      return `The print run closed without a confirmed receipt; printing again and the ${plural(p.tasks - 1, "placement")} need ${formatMoney(p.estimated)}, which fits the ${formatMoney(p.budget)} budget with ${spare(p)} to spare, so the print run goes out again`;
    case "PLACEMENTS":
      return `Print spend is confirmed at ${formatMoney(p.confirmedSpend)}; the ${plural(p.tasks, "placement")} need ${formatMoney(p.estimated)}, which fits the ${formatMoney(p.budget)} budget with ${spare(p)} to spare, so they go out now`;
  }
};

const stageWords = (p: z.output<typeof stageOverBudget>): string =>
  p.reason === "PLACEMENTS_OVER_BUDGET"
    ? `Stopped before sending the placements: ${formatMoney(p.confirmedSpend)} is confirmed for printing and the ${plural(p.tasks, "placement")} need ${formatMoney(p.estimated)}`
    : `Stopped before printing again: ${formatMoney(p.confirmedSpend)} is confirmed so far and the reprint and ${plural(p.tasks - 1, "placement")} need ${formatMoney(p.estimated)}`;

const approvalSummary = (p: z.output<typeof approvalRequest>): string => {
  if (p.reason === "RECOVERY_OVER_BUDGET") return recoveryOverBudgetWords(p);
  if (p.reason === "EXPENSE_DISPUTED") {
    return `Stopped until a person reviews a ${formatMoney(p.amount)} receipt: ${p.explanation}`;
  }
  if (p.reason === "OVER_BUDGET") {
    return `Stopped before commissioning anything: the approved plan needs ${formatMoney(p.estimated)}, ${formatMoney(p.shortfall)} more than the ${formatMoney(p.budget)} budget, so it needs the customer's approval`;
  }
  return `${stageWords(p)}, ${formatMoney(p.shortfall)} over the ${formatMoney(p.budget)} budget, so they need the customer's approval`;
};

export const budgetDescribers: Describers = {
  BUDGET_CHECKED: describe(budgetCheck, "DATUM_RULES", budgetCheckSummary),
  APPROVAL_REQUESTED: describe(approvalRequest, "DATUM_RULES", approvalSummary),
};
