import { describe, expect, it } from "vitest";
import type { Money } from "../src/contract";
import { recoveryKey } from "../src/recovery";
import {
  chosenRecoveries,
  pricedAction,
  standardRecoveryPlan,
  summarizeVerdict,
} from "../src/recovery-plan";
import {
  validateRemediation,
  type RemediationAuthority,
  type RemediationGaps,
} from "../src/remediation";

const sgd = (amountMinor: number): Money => ({ amountMinor, currency: "SGD" });
const campaignId = "cmp_7k2m9q4w8z1x3c5v";
const deadline = "2026-10-07T17:00:00+08:00";
const terms = { assetVersion: 1, ratePerSpot: sgd(500) };

const authority: RemediationAuthority = {
  campaignId,
  approvedSpotCodes: ["A", "B", "C", "D"],
  unresolved: [
    { spotCode: "B", reason: { kind: "TASK_ENDED", failure: "TASK_EXPIRED" } },
    { spotCode: "C", reason: { kind: "CLOSED_WITHOUT_PASS", lastFailure: "QR_NOT_FOUND" } },
  ],
  approvedAssetVersion: 1,
  approvedCopy: { headline: "Free oat flat white", subcopy: "Show this card at Kopi Lab." },
  budget: {
    approvedBudget: sgd(5000),
    expenses: [{ amount: sgd(1380), status: "CONFIRMED" }],
    committedOpenSpend: sgd(0),
  },
  deadline,
  now: "2026-10-07T16:13:00+08:00",
  tasks: ["A", "B", "C", "D"].map((spotCode) => ({
    idempotencyKey: recoveryKey(campaignId, spotCode, 1),
    spotCodes: [spotCode],
    open: false,
  })),
};

const gaps: RemediationGaps = {
  missingSpots: [...authority.unresolved],
  remainingBudgetMinor: 3620,
  minutesToDeadline: 47,
  openTasks: [],
};

describe("standardRecoveryPlan", () => {
  it("places each unresolved spot once at the agreed rate, due at the deadline", () => {
    expect(standardRecoveryPlan(gaps, deadline, terms)).toEqual({
      actions: [
        {
          spotCodes: ["B"],
          assetVersion: 1,
          publicCopy: null,
          estimatedCost: sgd(500),
          dueBy: deadline,
        },
        {
          spotCodes: ["C"],
          assetVersion: 1,
          publicCopy: null,
          estimatedCost: sgd(500),
          dueBy: deadline,
        },
      ],
    });
  });

  it("is accepted by the same validation any proposed plan goes through", () => {
    const verdict = validateRemediation(standardRecoveryPlan(gaps, deadline, terms), authority);
    expect(verdict).toMatchObject({ outcome: "ACCEPTED", planCost: sgd(1000) });
  });
});

describe("pricedAction", () => {
  it("prices a trip by the number of spots it covers, never by a model's number", () => {
    expect(pricedAction(["B", "C"], deadline, terms).estimatedCost).toEqual(sgd(1000));
  });
});

describe("chosenRecoveries", () => {
  it("keys a batched trip by its coverage and each placement by its own recovery key", () => {
    const verdict = validateRemediation(
      { actions: [pricedAction(["C", "B"], "2026-10-07T16:45:00+08:00", terms)] },
      authority,
    );
    if (verdict.outcome !== "ACCEPTED")
      throw new Error(`Expected acceptance, got ${verdict.outcome}`);
    expect(
      chosenRecoveries(campaignId, verdict.actions, ["Both boards are on Telok Ayer."]),
    ).toEqual([
      {
        idempotencyKey: `campaign:${campaignId}:spot:B:attempt:2+spot:C:attempt:2`,
        spotCodes: ["C", "B"],
        tasks: [
          { spotCode: "C", attempt: 2, idempotencyKey: recoveryKey(campaignId, "C", 2) },
          { spotCode: "B", attempt: 2, idempotencyKey: recoveryKey(campaignId, "B", 2) },
        ],
        estimatedCost: sgd(1000),
        dueBy: "2026-10-07T16:45:00+08:00",
        runnerNote: "Both boards are on Telok Ayer.",
      },
    ]);
  });
});

describe("summarizeVerdict", () => {
  it("keeps the shortfall and revised maximum of a plan that needs approval", () => {
    const tight = { ...authority, budget: { ...authority.budget, approvedBudget: sgd(1880) } };
    const verdict = validateRemediation(standardRecoveryPlan(gaps, deadline, terms), tight);
    expect(summarizeVerdict(verdict)).toEqual({
      outcome: "NEEDS_APPROVAL",
      reason: null,
      actionIndex: null,
      spotCode: null,
      planCost: sgd(1000),
      shortfall: sgd(500),
      revisedMaximum: sgd(2380),
    });
  });

  it("names the rule and the spot of a rejected plan", () => {
    const verdict = validateRemediation(
      { actions: [pricedAction(["A"], deadline, terms)] },
      authority,
    );
    expect(summarizeVerdict(verdict)).toMatchObject({
      outcome: "REJECTED",
      reason: "SPOT_NOT_UNRESOLVED",
      actionIndex: 0,
      spotCode: "A",
    });
  });
});
