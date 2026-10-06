import { describe, expect, it } from "vitest";
import { firstInvalidStep, firstStepError } from "../src/components/campaign-form/form-steps";
import {
  emptyCampaignForm,
  validateCampaignForm,
} from "../src/components/campaign-form/form-values";

const now = Date.parse("2026-10-07T00:00:00Z");
const valid = {
  ...emptyCampaignForm,
  brandName: "Test brand",
  message: "Come meet the team",
  destinationUrl: "https://example.com",
  spots: [{ key: 9, name: "Reception", instructions: "At the approved reception desk" }],
  deadlineDate: "2026-10-07",
  deadlineTime: "17:00",
  budget: "50.00",
};

describe("guided campaign brief", () => {
  it("blocks an empty first step and identifies its first field", () => {
    const errors = validateCampaignForm(emptyCampaignForm, now);
    expect(firstInvalidStep(emptyCampaignForm, errors)).toBe(0);
    expect(firstStepError(0, emptyCampaignForm, errors)).toBe("brand-name");
  });

  it("allows the message step to advance before later fields are filled", () => {
    const values = { ...valid, spots: emptyCampaignForm.spots, budget: "", deadlineTime: "" };
    const errors = validateCampaignForm(values, now);
    expect(firstStepError(0, values, errors)).toBeNull();
    expect(firstInvalidStep(values, errors)).toBe(1);
  });

  it("focuses the correct location after spots have been removed or added", () => {
    const values = { ...valid, spots: [{ key: 42, name: "Lobby", instructions: "" }] };
    const errors = validateCampaignForm(values, now);
    expect(firstStepError(1, values, errors)).toBe("spot-42-place");
    expect(firstInvalidStep(values, errors)).toBe(1);
  });

  it("sends final validation back to an earlier invalid message", () => {
    const values = { ...valid, destinationUrl: "not a valid URL" };
    const errors = validateCampaignForm(values, now);
    expect(firstInvalidStep(values, errors)).toBe(0);
    expect(firstStepError(0, values, errors)).toBe("destination-url");
  });

  it("catches a deadline that passed while the customer was filling the brief", () => {
    const errors = validateCampaignForm(valid, Date.parse("2026-10-07T10:00:00Z"));
    expect(firstInvalidStep(valid, errors)).toBe(2);
    expect(firstStepError(2, valid, errors)).toBe("deadline-date");
  });

  it("allows a complete brief with an optional brand URL left empty", () => {
    expect(firstInvalidStep(valid, validateCampaignForm(valid, now))).toBeNull();
  });
});
