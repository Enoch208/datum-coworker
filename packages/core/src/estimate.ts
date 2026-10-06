import type { Currency, Money, SpotCode } from "./contract";
import { compareMoney, formatMoney, multiplyMoney, sumMoney } from "./money";

export type PlanStepDraft =
  { type: "PRINT_AND_COLLECT"; quantity: number } | { type: "PLACE_SPOT"; spotCode: SpotCode };

export type EstimatedPlanStep = PlanStepDraft & { estimatedCost: Money };

export interface CostRates {
  printCostPerCopy: Money;
  placementCostPerSpot: Money;
}

export interface PlanEstimate {
  steps: EstimatedPlanStep[];
  total: Money;
}

const assertRate = (rate: Money, name: string): void => {
  if (!Number.isSafeInteger(rate.amountMinor) || rate.amountMinor < 0) {
    throw new RangeError(`The ${name} rate must be a non-negative whole amount`);
  }
};

const stepCost = (step: PlanStepDraft, rates: CostRates): Money =>
  step.type === "PRINT_AND_COLLECT"
    ? multiplyMoney(rates.printCostPerCopy, step.quantity)
    : { ...rates.placementCostPerSpot };

export const estimatePlan = (
  steps: readonly PlanStepDraft[],
  rates: CostRates,
  currency: Currency,
): PlanEstimate => {
  assertRate(rates.printCostPerCopy, "print");
  assertRate(rates.placementCostPerSpot, "placement");
  const estimated = steps.map((step) => ({ ...step, estimatedCost: stepCost(step, rates) }));
  return {
    steps: estimated,
    total: sumMoney(
      estimated.map((step) => step.estimatedCost),
      currency,
    ),
  };
};

export const overBudgetWarning = (estimate: Money, budget: Money): string | null =>
  compareMoney(estimate, budget) > 0
    ? `The estimated physical spend of ${formatMoney(estimate)} is above the ${formatMoney(budget)} budget. Approving does not raise the budget: Datum stops and asks before spending past it.`
    : null;
