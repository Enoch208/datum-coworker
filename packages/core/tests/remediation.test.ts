import { describe, expect, it } from "vitest";
import type { Money } from "../src/contract";
import type { UnresolvedRequirement } from "../src/goal";
import { recoveryKey, type TaskCoverage } from "../src/recovery";
import {
  remediationGaps,
  validateRemediation,
  type RemediationAction,
  type RemediationAuthority,
} from "../src/remediation";

const sgd = (amountMinor: number): Money => ({ amountMinor, currency: "SGD" });
const campaignId = "cmp_7k2m9q4w8z1x3c5v";
const key = (spotCode: string, attempt: number) => recoveryKey(campaignId, spotCode, attempt);
const copy = { headline: "Datum is live at TOKEN2049", subcopy: "Scan to see what it shipped" };
const expired = (spotCode: string): UnresolvedRequirement => ({
  spotCode,
  reason: { kind: "TASK_ENDED", failure: "TASK_EXPIRED" },
});
const firstPassTask = (spotCode: string): TaskCoverage => ({
  idempotencyKey: key(spotCode, 1),
  spotCodes: [spotCode],
  open: false,
});

const authority: RemediationAuthority = {
  campaignId,
  approvedSpotCodes: ["A", "B", "C", "D"],
  unresolved: [expired("C")],
  approvedAssetVersion: 1,
  approvedCopy: copy,
  budget: {
    approvedBudget: sgd(5000),
    expenses: [
      { amount: sgd(1380), status: "CONFIRMED" },
      { amount: sgd(2000), status: "CONFIRMED" },
    ],
    committedOpenSpend: sgd(0),
  },
  deadline: "2026-10-07T17:00:00+08:00",
  now: "2026-10-07T16:13:00+08:00",
  tasks: ["A", "B", "C", "D"].map(firstPassTask),
};
const twoMisses = { ...authority, unresolved: [expired("B"), expired("C")] };

const action = (spotCodes: string[], costMinor = 800): RemediationAction => ({
  spotCodes,
  assetVersion: 1,
  publicCopy: null,
  estimatedCost: sgd(costMinor),
  dueBy: "2026-10-07T16:45:00+08:00",
});

describe("validateRemediation", () => {
  it("accepts one action for one miss and keys it as Spot C's second attempt", () => {
    expect(validateRemediation({ actions: [action(["C"])] }, authority)).toEqual({
      outcome: "ACCEPTED",
      planCost: sgd(800),
      actions: [
        {
          action: action(["C"]),
          idempotencyKey: key("C", 2),
          coverage: [{ spotCode: "C", attempt: 2 }],
        },
      ],
    });
  });

  it("replans two misses as one action per spot from the remaining budget and deadline", () => {
    expect(remediationGaps(twoMisses)).toEqual({
      missingSpots: [expired("B"), expired("C")],
      remainingBudgetMinor: 1620,
      minutesToDeadline: 47,
      openTasks: [],
    });
    const verdict = validateRemediation(
      { actions: [action(["B"], 800), action(["C"], 800)] },
      twoMisses,
    );
    expect(verdict).toMatchObject({ outcome: "ACCEPTED", planCost: sgd(1600) });
    expect(
      verdict.outcome === "ACCEPTED" && verdict.actions.map((accepted) => accepted.idempotencyKey),
    ).toEqual([key("B", 2), key("C", 2)]);
  });

  it("accepts two misses covered by one batched runner trip", () => {
    const verdict = validateRemediation({ actions: [action(["B", "C"], 1000)] }, twoMisses);
    expect(verdict).toMatchObject({
      outcome: "ACCEPTED",
      planCost: sgd(1000),
      actions: [{ idempotencyKey: `${key("B", 2)}+spot:C:attempt:2` }],
    });
  });

  it("needs approval with the shortfall when a SGD 9 fix meets SGD 4 of remaining authority", () => {
    const tight = { ...authority, budget: { ...authority.budget, committedOpenSpend: sgd(1220) } };
    expect(validateRemediation({ actions: [action(["C"], 900)] }, tight)).toEqual({
      outcome: "NEEDS_APPROVAL",
      planCost: sgd(900),
      shortfall: sgd(500),
      revisedMaximum: sgd(5500),
    });
  });

  it("budgets the plan as a whole, not action by action", () => {
    const plan = { actions: [action(["B"], 900), action(["C"], 900)] };
    expect(validateRemediation(plan, twoMisses)).toMatchObject({
      outcome: "NEEDS_APPROVAL",
      shortfall: sgd(180),
    });
  });

  it("returns EXPIRED once the deadline has passed, before any other check", () => {
    const late = { ...authority, now: "2026-10-07T17:00:01+08:00" };
    expect(validateRemediation({ actions: [] }, late)).toEqual({ outcome: "EXPIRED" });
  });

  it("creates no new action for a miss that already has an open recovery task", () => {
    const reopened = {
      ...authority,
      tasks: [...authority.tasks, { idempotencyKey: key("C", 2), spotCodes: ["C"], open: true }],
    };
    expect(remediationGaps(reopened)).toMatchObject({ missingSpots: [], openTasks: [key("C", 2)] });
    expect(validateRemediation({ actions: [action(["C"])] }, reopened)).toMatchObject({
      outcome: "REJECTED",
      reason: "DUPLICATE_OPEN_TASK",
      actionIndex: 0,
      spotCode: null,
    });
  });

  it("refuses to re-commission a spot that an open batched trip already covers", () => {
    const batchKey = `${key("B", 2)}+spot:C:attempt:2`;
    const batched = {
      ...twoMisses,
      tasks: [...authority.tasks, { idempotencyKey: batchKey, spotCodes: ["B", "C"], open: true }],
    };
    expect(validateRemediation({ actions: [action(["C"])] }, batched)).toMatchObject({
      outcome: "REJECTED",
      reason: "SPOT_HAS_OPEN_TASK",
      spotCode: "C",
    });
  });

  it.each<[string, RemediationAction[], string, string | null]>([
    ["an empty plan", [], "EMPTY_PLAN", null],
    ["an action with no spot", [action([])], "EMPTY_ACTION", null],
    ["a new asset version", [{ ...action(["C"]), assetVersion: 2 }], "ASSET_NOT_APPROVED", null],
    [
      "changed public copy",
      [{ ...action(["C"]), publicCopy: { ...copy, headline: "50% off" } }],
      "COPY_CHANGED",
      null,
    ],
    [
      "a due time after the deadline",
      [{ ...action(["C"]), dueBy: "2026-10-07T17:01:00+08:00" }],
      "DUE_AFTER_DEADLINE",
      null,
    ],
    [
      "a due time already past",
      [{ ...action(["C"]), dueBy: "2026-10-07T16:00:00+08:00" }],
      "DUE_BEFORE_NOW",
      null,
    ],
    ["a spot outside the approval", [action(["E"])], "SPOT_NOT_APPROVED", "E"],
    ["a spot that already passed", [action(["A"])], "SPOT_NOT_UNRESOLVED", "A"],
    ["the same spot twice", [action(["C"]), action(["C"])], "SPOT_REPEATED_IN_PLAN", "C"],
  ])("rejects %s", (_label, actions, reason, spotCode) => {
    expect(validateRemediation({ actions }, authority)).toMatchObject({
      outcome: "REJECTED",
      reason,
      spotCode,
    });
  });

  it("accepts the approved copy restated unchanged", () => {
    const restated = { ...action(["C"]), publicCopy: { ...copy } };
    expect(validateRemediation({ actions: [restated] }, authority).outcome).toBe("ACCEPTED");
  });

  it("names the offending action in a rejection", () => {
    const plan = { actions: [action(["B"]), action(["C"])] };
    expect(validateRemediation(plan, authority)).toMatchObject({ actionIndex: 0, spotCode: "B" });
  });

  it("validates identically whether or not the miss is flagged as induced", () => {
    const flagged = { ...expired("C"), inducedMiss: true };
    const withFlag = { ...authority, unresolved: [flagged] };
    const plan = { actions: [action(["C"])] };
    expect(validateRemediation(plan, withFlag)).toEqual(validateRemediation(plan, authority));
    expect(remediationGaps(withFlag).missingSpots).toEqual([expired("C")]);
  });
});
