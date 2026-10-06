import { describe, expect, it } from "vitest";
import type { LedgerExpense } from "../src/budget";
import type { EvidenceEvaluation, EvidenceFailure, Money } from "../src/contract";
import { evaluateGoal, type GoalInput, type SpotEvidenceHistory } from "../src/goal";

const sgd = (amountMinor: number): Money => ({ amountMinor, currency: "SGD" });
const confirmed = (amountMinor: number): LedgerExpense => ({
  amount: sgd(amountMinor),
  status: "CONFIRMED",
});

const pass: EvidenceEvaluation = {
  verdict: "PASS",
  failure: null,
  checks: {
    photoPresent: true,
    qrDecodable: true,
    qrMatchesCampaign: true,
    qrMatchesSpot: true,
    taskOpen: true,
    beforeDeadline: true,
  },
  decoded: { campaignId: "cmp_7k2m9q4w8z1x3c5v", spotCode: "A" },
};
const fail = (failure: EvidenceFailure): EvidenceEvaluation => ({
  verdict: "FAIL",
  failure,
  checks: {
    photoPresent: false,
    qrDecodable: false,
    qrMatchesCampaign: false,
    qrMatchesSpot: false,
    taskOpen: false,
    beforeDeadline: false,
  },
  decoded: null,
});

const spot = (spotCode: string, ...evaluations: EvidenceEvaluation[]): SpotEvidenceHistory => ({
  spotCode,
  evaluations,
});

const firstPass = [
  spot("A", pass),
  spot("B", pass),
  spot("C", fail("TASK_EXPIRED")),
  spot("D", pass),
];
const afterRecovery = [
  ...firstPass.slice(0, 2),
  spot("C", fail("TASK_EXPIRED"), pass),
  spot("D", pass),
];

const input: GoalInput = {
  spots: firstPass,
  approvalValid: true,
  now: "2026-10-07T16:13:00+08:00",
  deadline: "2026-10-07T17:00:00+08:00",
  approvedBudget: sgd(5000),
  expenses: [confirmed(1380), confirmed(2000)],
};

describe("evaluateGoal", () => {
  it("reports 3 of 4 after the first pass with Spot C unresolved because its task expired", () => {
    expect(evaluateGoal(input)).toEqual({
      requiredSpotCodes: ["A", "B", "C", "D"],
      passedSpotCodes: ["A", "B", "D"],
      missingSpotCodes: ["C"],
      unresolved: [{ spotCode: "C", reason: { kind: "TASK_ENDED", failure: "TASK_EXPIRED" } }],
      approvalValid: true,
      beforeDeadline: true,
      minutesToDeadline: 47,
      confirmedSpend: sgd(3380),
      withinBudget: true,
      complete: false,
      stop: null,
    });
  });

  it("completes once Spot C passes on its second attempt", () => {
    const goal = evaluateGoal({
      ...input,
      spots: afterRecovery,
      expenses: [...input.expenses, confirmed(400)],
    });
    expect(goal).toMatchObject({
      unresolved: [],
      complete: true,
      stop: "COMPLETED",
      confirmedSpend: sgd(3780),
    });
  });

  it("reports any number of unresolved requirements, each with why it is unresolved", () => {
    const spots = [
      spot("A"),
      spot("B", fail("QR_WRONG_SPOT")),
      spot("C", fail("EXECUTOR_CANCELLED")),
      spot("D"),
    ];
    expect(evaluateGoal({ ...input, spots }).unresolved).toEqual([
      { spotCode: "A", reason: { kind: "NO_EVIDENCE_YET" } },
      { spotCode: "B", reason: { kind: "EVIDENCE_FAILED", failure: "QR_WRONG_SPOT" } },
      { spotCode: "C", reason: { kind: "TASK_ENDED", failure: "EXECUTOR_CANCELLED" } },
      { spotCode: "D", reason: { kind: "NO_EVIDENCE_YET" } },
    ]);
  });

  it("explains an unresolved spot with its most recent failure", () => {
    const spots = [spot("C", fail("QR_NOT_FOUND"), fail("LATE_EVIDENCE"))];
    expect(evaluateGoal({ ...input, spots }).unresolved).toEqual([
      { spotCode: "C", reason: { kind: "EVIDENCE_FAILED", failure: "LATE_EVIDENCE" } },
    ]);
  });

  it("keeps a passed spot resolved when a later upload fails", () => {
    const spots = [spot("A", pass, fail("QR_WRONG_SPOT"))];
    expect(evaluateGoal({ ...input, spots })).toMatchObject({
      passedSpotCodes: ["A"],
      complete: true,
    });
  });

  it("completes when now is exactly the deadline", () => {
    const goal = evaluateGoal({ ...input, spots: afterRecovery, now: input.deadline });
    expect(goal).toMatchObject({ complete: true, minutesToDeadline: 0 });
  });

  it("expires instead of completing once the deadline has passed, even with every spot passing", () => {
    const goal = evaluateGoal({ ...input, spots: afterRecovery, now: "2026-10-07T17:00:01+08:00" });
    expect(goal).toMatchObject({
      beforeDeadline: false,
      complete: false,
      stop: "EXPIRED_INCOMPLETE",
    });
  });

  it("lets the deadline win over an invalid approval or an overrun", () => {
    const expired = { ...input, now: "2026-10-07T17:30:00+08:00", approvalValid: false };
    expect(evaluateGoal({ ...expired, expenses: [confirmed(6000)] }).stop).toBe(
      "EXPIRED_INCOMPLETE",
    );
  });

  it("stops at NEEDS_APPROVAL without a valid approval", () => {
    const goal = evaluateGoal({ ...input, spots: afterRecovery, approvalValid: false });
    expect(goal).toMatchObject({ complete: false, stop: "NEEDS_APPROVAL" });
  });

  it("stops at NEEDS_APPROVAL when confirmed spend exceeds the approved budget", () => {
    const goal = evaluateGoal({ ...input, spots: afterRecovery, expenses: [confirmed(5001)] });
    expect(goal).toMatchObject({ withinBudget: false, complete: false, stop: "NEEDS_APPROVAL" });
  });

  it("measures spend from CONFIRMED expenses only", () => {
    const expenses = [confirmed(3780), { amount: sgd(9000), status: "SUBMITTED" as const }];
    expect(evaluateGoal({ ...input, spots: afterRecovery, expenses })).toMatchObject({
      confirmedSpend: sgd(3780),
      complete: true,
    });
  });

  it("never completes a campaign with no required spots", () => {
    expect(evaluateGoal({ ...input, spots: [] })).toMatchObject({ complete: false, stop: null });
  });

  it("ignores QR scans: zero scans and seventeen scans evaluate identically", () => {
    const noScans = afterRecovery.map((history) => ({ ...history, scans: 0 }));
    const manyScans = afterRecovery.map((history) => ({ ...history, scans: 17 }));
    expect(evaluateGoal({ ...input, spots: noScans })).toEqual(
      evaluateGoal({ ...input, spots: manyScans }),
    );
    expect(evaluateGoal({ ...input, spots: noScans }).complete).toBe(true);
  });

  it("evaluates identically whether or not Spot C is flagged as an induced miss", () => {
    const flaggedC = { ...spot("C", fail("TASK_EXPIRED")), inducedMiss: true };
    const unflaggedC = { ...spot("C", fail("TASK_EXPIRED")), inducedMiss: false };
    const withFlag = [spot("A", pass), spot("B", pass), flaggedC, spot("D", pass)];
    const withoutFlag = [spot("A", pass), spot("B", pass), unflaggedC, spot("D", pass)];
    expect(evaluateGoal({ ...input, spots: withFlag })).toEqual(
      evaluateGoal({ ...input, spots: withoutFlag }),
    );
    expect(evaluateGoal({ ...input, spots: withFlag })).toEqual(evaluateGoal(input));
  });
});
