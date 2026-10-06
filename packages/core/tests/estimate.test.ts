import { describe, expect, it } from "vitest";
import type { Money } from "../src/contract";
import { estimatePlan, overBudgetWarning, type CostRates } from "../src/estimate";
import { MoneyError, multiplyMoney } from "../src/money";

const sgd = (amountMinor: number): Money => ({ amountMinor, currency: "SGD" });
const rates: CostRates = { printCostPerCopy: sgd(120), placementCostPerSpot: sgd(800) };

describe("estimatePlan", () => {
  it("prices each step from the explicit rates and sums them", () => {
    const estimate = estimatePlan(
      [
        { type: "PRINT_AND_COLLECT", quantity: 4 },
        { type: "PLACE_SPOT", spotCode: "A" },
        { type: "PLACE_SPOT", spotCode: "B" },
      ],
      rates,
      "SGD",
    );
    expect(estimate).toEqual({
      steps: [
        { type: "PRINT_AND_COLLECT", quantity: 4, estimatedCost: sgd(480) },
        { type: "PLACE_SPOT", spotCode: "A", estimatedCost: sgd(800) },
        { type: "PLACE_SPOT", spotCode: "B", estimatedCost: sgd(800) },
      ],
      total: sgd(2_080),
    });
  });

  it("keeps cent-exact totals that floats would round", () => {
    const estimate = estimatePlan(
      [{ type: "PRINT_AND_COLLECT", quantity: 3 }],
      { printCostPerCopy: sgd(29), placementCostPerSpot: sgd(0) },
      "SGD",
    );
    expect(estimate.total).toEqual(sgd(87));
  });

  it("estimates an empty plan at zero", () => {
    expect(estimatePlan([], rates, "SGD").total).toEqual(sgd(0));
  });

  it("refuses a rate in another currency", () => {
    const usd = Object.assign(sgd(100), { currency: "USD" });
    expect(() =>
      estimatePlan(
        [{ type: "PLACE_SPOT", spotCode: "A" }],
        { ...rates, placementCostPerSpot: usd },
        "SGD",
      ),
    ).toThrow(MoneyError);
  });

  it("refuses a negative rate", () => {
    expect(() => estimatePlan([], { ...rates, printCostPerCopy: sgd(-1) }, "SGD")).toThrow(
      RangeError,
    );
  });

  it("does not share the rate object with a step", () => {
    const estimate = estimatePlan([{ type: "PLACE_SPOT", spotCode: "A" }], rates, "SGD");
    expect(estimate.steps[0]?.estimatedCost).not.toBe(rates.placementCostPerSpot);
  });
});

describe("multiplyMoney", () => {
  it("multiplies by a whole number of units", () => {
    expect(multiplyMoney(sgd(120), 0)).toEqual(sgd(0));
    expect(multiplyMoney(sgd(120), 25)).toEqual(sgd(3_000));
  });

  it.each([-1, 1.5, Number.NaN])("refuses the multiplier %s", (factor) => {
    expect(() => multiplyMoney(sgd(120), factor)).toThrow(RangeError);
  });

  it("refuses an overflowing product", () => {
    expect(() => multiplyMoney(sgd(Number.MAX_SAFE_INTEGER), 2)).toThrow(
      expect.objectContaining({ code: "AMOUNT_TOO_LARGE" }),
    );
  });
});

describe("overBudgetWarning", () => {
  it("warns only when the estimate is above the budget", () => {
    expect(overBudgetWarning(sgd(5_000), sgd(5_000))).toBeNull();
    expect(overBudgetWarning(sgd(4_999), sgd(5_000))).toBeNull();
    expect(overBudgetWarning(sgd(6_200), sgd(5_000))).toBe(
      "The estimated physical spend of SGD 62.00 is above the SGD 50.00 budget. Approving does not raise the budget: Datum stops and asks before spending past it.",
    );
  });
});
