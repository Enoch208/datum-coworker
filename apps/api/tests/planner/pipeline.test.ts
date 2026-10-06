import { draftPlaybook, type CostRates } from "@datum/core";
import { describe, expect, it } from "vitest";
import { PlannerModelError } from "../../src/planner/model";
import { PlanRejectedError, planCampaign } from "../../src/planner/pipeline";
import type { PlannerInput } from "../../src/planner/prompt";
import { fixturePlanner, plannerFixture } from "./fixture-model";

const sgd = (amountMinor: number) => ({ amountMinor, currency: "SGD" as const });
const rates: CostRates = { printCostPerCopy: sgd(150), placementCostPerSpot: sgd(1_000) };

const input: PlannerInput = {
  brandName: "Kopi Lab",
  message: "Show this card for a free oat flat white",
  destinationUrl: "https://kopilab.example/offer",
  playbook: draftPlaybook({
    brandId: "brd_1",
    brandName: "Kopi Lab",
    website: null,
    message: "Show this card for a free oat flat white",
    budget: sgd(5_000),
    page: { outcome: "NOT_GIVEN" },
  }),
  spots: [
    { code: "A", name: "Amoy Street cafe window", instructions: "Tape inside the glass" },
    { code: "B", name: "Telok Ayer notice board", instructions: "Pin at eye level" },
  ],
  budget: sgd(5_000),
  deadline: "2026-10-07T17:00:00+08:00",
  now: "2026-10-06T09:00:00Z",
};

const plan = (fixture: string, budget = input.budget, ruleWarnings: string[] = []) =>
  planCampaign(
    fixturePlanner(plannerFixture(fixture)),
    { ...input, budget },
    {
      rates,
      ruleWarnings,
    },
  );

describe("planCampaign", () => {
  it("keeps the model's copy and steps and prices them with the rules", async () => {
    const proposal = await plan("plan-accepted");
    expect(proposal).toEqual({
      model: "claude-sonnet-5-5",
      copy: {
        headline: "Your oat flat white is on us",
        subcopy:
          "Scan the code, show this card at Kopi Lab on Amoy Street and the first oat flat white is free.",
      },
      printFormat: "A6",
      steps: [
        { type: "PRINT_AND_COLLECT", quantity: 4, estimatedCost: sgd(600) },
        { type: "PLACE_SPOT", spotCode: "A", estimatedCost: sgd(1_000) },
        { type: "PLACE_SPOT", spotCode: "B", estimatedCost: sgd(1_000) },
      ],
      estimatedSpend: sgd(2_600),
      assumptions: ["Two spare cards are printed in case one is damaged while placing."],
      customerWarnings: [
        "The notice board at Telok Ayer may need the building manager's permission.",
      ],
    });
  });

  it("puts rule warnings and an over-budget warning before the model's own", async () => {
    const proposal = await plan("plan-accepted", sgd(2_000), ["The brand page could not be read."]);
    expect(proposal.customerWarnings).toEqual([
      "The brand page could not be read.",
      "The estimated physical spend of SGD 26.00 is above the SGD 20.00 budget. Approving does not raise the budget: Datum stops and asks before spending past it.",
      "The notice board at Telok Ayer may need the building manager's permission.",
    ]);
    expect(proposal.estimatedSpend).toEqual(sgd(2_600));
  });

  it.each([
    ["plan-unknown-spot", "UNKNOWN_SPOT"],
    ["plan-spot-missing", "SPOT_NOT_PLACED"],
    ["plan-too-few-copies", "PRINT_QUANTITY_TOO_LOW"],
    ["plan-forbidden-claim", "FORBIDDEN_CLAIM"],
    ["plan-headline-too-long", "HEADLINE_TOO_LONG"],
    ["plan-unknown-format", "MALFORMED_OUTPUT"],
    ["plan-with-costs", "MALFORMED_OUTPUT"],
  ])("rejects the %s output as %s", async (fixture, reason) => {
    const rejected = plan(fixture);
    await expect(rejected).rejects.toBeInstanceOf(PlanRejectedError);
    await expect(rejected).rejects.toMatchObject({ reason, model: "claude-sonnet-5-5" });
  });

  it("never accepts a cost the model invented", async () => {
    await expect(plan("plan-with-costs")).rejects.toThrow(/estimatedSpend|estimatedCost/);
  });

  it("passes a model failure through untouched", async () => {
    const failing = {
      propose: () => Promise.reject(new PlannerModelError("REFUSED", "declined")),
    };
    await expect(planCampaign(failing, input, { rates, ruleWarnings: [] })).rejects.toMatchObject({
      code: "REFUSED",
    });
  });

  it("gives the model the brief, spots, playbook rules, budget and deadline as data", async () => {
    const model = fixturePlanner(plannerFixture("plan-accepted"));
    await planCampaign(model, input, { rates, ruleWarnings: [] });
    const [prompt] = model.prompts;
    expect(prompt?.system).toContain("never estimate or mention costs");
    const brief: unknown = JSON.parse(prompt?.user.replace("Plan this campaign.\n\n", "") ?? "{}");
    expect(brief).toMatchObject({
      brand: "Kopi Lab",
      message: "Show this card for a free oat flat white",
      spots: [{ code: "A" }, { code: "B" }],
      budget: "SGD 50.00",
      deadline: "2026-10-07T17:00:00+08:00",
      playbook: { forbiddenClaims: expect.arrayContaining(["#1", "guaranteed"]) as unknown },
    });
  });
});
