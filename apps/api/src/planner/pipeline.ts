import {
  estimatePlan,
  normalizeCopy,
  overBudgetWarning,
  validatePlanDraft,
  type CostRates,
  type EstimatedPlanStep,
  type Money,
  type PlanDraft,
  type PlanRejectionCode,
  type PrintFormat,
  type PublicCopy,
} from "@datum/core";
import { z } from "zod";
import type { PlannerModel } from "./model";
import { plannerPrompt, type PlannerInput } from "./prompt";
import { plannerOutputSchema } from "./schema";

export interface PlannedProposal {
  readonly model: string;
  readonly copy: PublicCopy;
  readonly printFormat: PrintFormat;
  readonly steps: EstimatedPlanStep[];
  readonly estimatedSpend: Money;
  readonly assumptions: string[];
  readonly customerWarnings: string[];
}

export interface PlanningRules {
  readonly rates: CostRates;
  readonly ruleWarnings: readonly string[];
}

export type PlanRejectionReason = PlanRejectionCode | "MALFORMED_OUTPUT";

export class PlanRejectedError extends Error {
  readonly reason: PlanRejectionReason;
  readonly model: string;

  constructor(reason: PlanRejectionReason, detail: string, model: string) {
    super(detail);
    this.name = "PlanRejectedError";
    this.reason = reason;
    this.model = model;
  }
}

const cleanList = (items: readonly string[]): string[] =>
  items.map((item) => item.replace(/\s+/g, " ").trim()).filter((item) => item.length > 0);

const checkedDraft = (output: unknown, model: string, input: PlannerInput): PlanDraft => {
  const parsed = plannerOutputSchema.safeParse(output);
  if (!parsed.success) {
    throw new PlanRejectedError("MALFORMED_OUTPUT", z.prettifyError(parsed.error), model);
  }
  const draft = { ...parsed.data, ...normalizeCopy(parsed.data) };
  const rejection = validatePlanDraft(draft, {
    spotCodes: input.spots.map((spot) => spot.code),
    forbiddenClaims: input.playbook.forbiddenClaims,
  });
  if (rejection !== null) throw new PlanRejectedError(rejection.reason, rejection.detail, model);
  return draft;
};

export async function planCampaign(
  model: PlannerModel,
  input: PlannerInput,
  rules: PlanningRules,
): Promise<PlannedProposal> {
  const reply = await model.propose(plannerPrompt(input));
  const draft = checkedDraft(reply.output, reply.model, input);
  const estimate = estimatePlan(draft.steps, rules.rates, input.budget.currency);
  const budgetWarning = overBudgetWarning(estimate.total, input.budget);
  return {
    model: reply.model,
    copy: { headline: draft.headline, subcopy: draft.subcopy },
    printFormat: draft.printFormat,
    steps: estimate.steps,
    estimatedSpend: estimate.total,
    assumptions: cleanList(draft.assumptions),
    customerWarnings: [
      ...rules.ruleWarnings,
      ...(budgetWarning === null ? [] : [budgetWarning]),
      ...cleanList(draft.customerWarnings),
    ],
  };
}
