import { describe, expect, it } from "vitest";
import type { PlanStepDraft } from "../src/estimate";
import {
  copyRejection,
  normalizeCopy,
  validatePlanDraft,
  type PlanDraft,
  type PlanRules,
} from "../src/plan";

const rules: PlanRules = { spotCodes: ["A", "B"], forbiddenClaims: ["guaranteed", "#1"] };

const draft = (overrides: Partial<PlanDraft> = {}): PlanDraft => ({
  headline: "Free oat flat white",
  subcopy: "Scan the code and show this card at Kopi Lab on Amoy Street.",
  printFormat: "A6",
  assumptions: [],
  customerWarnings: [],
  steps: [
    { type: "PRINT_AND_COLLECT", quantity: 2 },
    { type: "PLACE_SPOT", spotCode: "A" },
    { type: "PLACE_SPOT", spotCode: "B" },
  ],
  ...overrides,
});

const withSteps = (steps: PlanStepDraft[]): PlanDraft => draft({ steps });

describe("validatePlanDraft", () => {
  it("accepts a plan that prints first and places every approved spot once", () => {
    expect(validatePlanDraft(draft(), rules)).toBeNull();
    expect(
      validatePlanDraft(
        withSteps([
          { type: "PRINT_AND_COLLECT", quantity: 5 },
          { type: "PLACE_SPOT", spotCode: "B" },
          { type: "PLACE_SPOT", spotCode: "A" },
        ]),
        rules,
      ),
    ).toBeNull();
  });

  it.each<[string, PlanDraft, string]>([
    ["an empty headline", draft({ headline: "" }), "HEADLINE_EMPTY"],
    ["a headline over the card limit", draft({ headline: "x".repeat(49) }), "HEADLINE_TOO_LONG"],
    ["an empty subcopy", draft({ subcopy: "" }), "SUBCOPY_EMPTY"],
    ["a subcopy over the card limit", draft({ subcopy: "x".repeat(121) }), "SUBCOPY_TOO_LONG"],
    ["a forbidden claim", draft({ headline: "Guaranteed great coffee" }), "FORBIDDEN_CLAIM"],
    [
      "a forbidden symbol claim in the subcopy",
      draft({ subcopy: "Rated #1 on Amoy Street" }),
      "FORBIDDEN_CLAIM",
    ],
    ["no print step", withSteps([{ type: "PLACE_SPOT", spotCode: "A" }]), "NO_PRINT_STEP"],
    [
      "two print steps",
      withSteps([
        { type: "PRINT_AND_COLLECT", quantity: 1 },
        { type: "PRINT_AND_COLLECT", quantity: 1 },
        { type: "PLACE_SPOT", spotCode: "A" },
        { type: "PLACE_SPOT", spotCode: "B" },
      ]),
      "EXTRA_PRINT_STEP",
    ],
    [
      "printing after placing",
      withSteps([
        { type: "PLACE_SPOT", spotCode: "A" },
        { type: "PRINT_AND_COLLECT", quantity: 2 },
        { type: "PLACE_SPOT", spotCode: "B" },
      ]),
      "PRINT_NOT_FIRST",
    ],
    [
      "zero copies",
      withSteps([{ type: "PRINT_AND_COLLECT", quantity: 0 }]),
      "PRINT_QUANTITY_INVALID",
    ],
    [
      "fractional copies",
      withSteps([{ type: "PRINT_AND_COLLECT", quantity: 2.5 }]),
      "PRINT_QUANTITY_INVALID",
    ],
    [
      "an absurd print run",
      withSteps([{ type: "PRINT_AND_COLLECT", quantity: 1_001 }]),
      "PRINT_QUANTITY_INVALID",
    ],
    [
      "fewer copies than spots",
      withSteps([
        { type: "PRINT_AND_COLLECT", quantity: 1 },
        { type: "PLACE_SPOT", spotCode: "A" },
        { type: "PLACE_SPOT", spotCode: "B" },
      ]),
      "PRINT_QUANTITY_TOO_LOW",
    ],
    [
      "a spot outside the approval",
      withSteps([
        { type: "PRINT_AND_COLLECT", quantity: 3 },
        { type: "PLACE_SPOT", spotCode: "A" },
        { type: "PLACE_SPOT", spotCode: "B" },
        { type: "PLACE_SPOT", spotCode: "C" },
      ]),
      "UNKNOWN_SPOT",
    ],
    [
      "a spot placed twice",
      withSteps([
        { type: "PRINT_AND_COLLECT", quantity: 3 },
        { type: "PLACE_SPOT", spotCode: "A" },
        { type: "PLACE_SPOT", spotCode: "A" },
        { type: "PLACE_SPOT", spotCode: "B" },
      ]),
      "SPOT_PLACED_TWICE",
    ],
    [
      "a spot never placed",
      withSteps([
        { type: "PRINT_AND_COLLECT", quantity: 2 },
        { type: "PLACE_SPOT", spotCode: "A" },
      ]),
      "SPOT_NOT_PLACED",
    ],
  ])("rejects %s", (_label, plan, reason) => {
    expect(validatePlanDraft(plan, rules)).toMatchObject({ reason });
  });

  it("explains a rejection in words", () => {
    expect(validatePlanDraft(draft({ headline: "x".repeat(60) }), rules)).toEqual({
      reason: "HEADLINE_TOO_LONG",
      detail: "The headline has 60 characters; the card fits 48",
    });
  });
});

describe("copyRejection", () => {
  it("matches a forbidden claim whatever its case or spacing", () => {
    expect(copyRejection({ headline: "GUARANTEED", subcopy: "ok" }, ["guaranteed"])).toMatchObject({
      reason: "FORBIDDEN_CLAIM",
    });
    expect(
      copyRejection({ headline: "Best   in Singapore", subcopy: "ok" }, ["best in singapore"]),
    ).toMatchObject({ reason: "FORBIDDEN_CLAIM" });
  });

  it("does not match a claim inside another word", () => {
    expect(
      copyRejection({ headline: "Unguaranteedly fresh", subcopy: "ok" }, ["guaranteed"]),
    ).toBeNull();
    expect(copyRejection({ headline: "Free coffee", subcopy: "ok" }, ["fre"])).toBeNull();
  });

  it("ignores an empty forbidden claim", () => {
    expect(copyRejection({ headline: "Free coffee", subcopy: "ok" }, [" "])).toBeNull();
  });
});

describe("normalizeCopy", () => {
  it("keeps the copy on one line without stray spaces", () => {
    expect(normalizeCopy({ headline: "  Free\n oat  flat white ", subcopy: "Scan\tme" })).toEqual({
      headline: "Free oat flat white",
      subcopy: "Scan me",
    });
  });
});
