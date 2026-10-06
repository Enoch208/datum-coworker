import { describe, expect, it } from "vitest";
import type { LedgerExpense } from "../src/budget";
import type { EvidenceFailure, Money } from "../src/contract";
import {
  attemptStateOf,
  evaluateGoal,
  firstPassOutcome,
  spotOutcome,
  type AttemptState,
  type GoalInput,
  type SpotEvidenceHistory,
  type TimedVerdict,
} from "../src/goal";

const sgd = (amountMinor: number): Money => ({ amountMinor, currency: "SGD" });
const confirmed = (amountMinor: number): LedgerExpense => ({
  amount: sgd(amountMinor),
  status: "CONFIRMED",
});

const deadline = "2026-10-07T17:00:00+08:00";
const at = (time: string): string => `2026-10-07T${time}:00+08:00`;

const pass = (time: string, attempt = 1): TimedVerdict => ({
  attempt,
  verdict: "PASS",
  failure: null,
  submittedAt: at(time),
});
const fail = (failure: EvidenceFailure, time: string, attempt = 1): TimedVerdict => ({
  attempt,
  verdict: "FAIL",
  failure,
  submittedAt: at(time),
});

const spot = (
  spotCode: string,
  attempts: readonly AttemptState[],
  ...evidence: TimedVerdict[]
): SpotEvidenceHistory => ({
  spotCode,
  evidence,
  attempts: attempts.map((state, index) => ({ attempt: index + 1, state })),
});

const placed = (spotCode: string, time: string) => spot(spotCode, ["OPEN"], pass(time));
const placedA = placed("A", "15:10");
const placedB = placed("B", "15:25");
const placedD = placed("D", "15:55");
const missedC = spot("C", ["COMPLETED"], fail("QR_NOT_FOUND", "15:40"));
const firstPass = [placedA, placedB, missedC, placedD];
const recoveredC = spot(
  "C",
  ["COMPLETED", "OPEN"],
  fail("QR_NOT_FOUND", "15:40"),
  pass("16:43", 2),
);
const afterRecovery = [placedA, placedB, recoveredC, placedD];

const input: GoalInput = {
  spots: firstPass,
  approvalValid: true,
  now: at("16:13"),
  deadline,
  approvedBudget: sgd(5000),
  expenses: [confirmed(1380), confirmed(2000)],
};

describe("evaluateGoal", () => {
  it("reports 3 of 4 after the first pass with Spot C closed without a valid photo", () => {
    expect(evaluateGoal(input)).toEqual({
      requiredSpotCodes: ["A", "B", "C", "D"],
      passedSpotCodes: ["A", "B", "D"],
      missingSpotCodes: ["C"],
      unresolved: [
        { spotCode: "C", reason: { kind: "CLOSED_WITHOUT_PASS", lastFailure: "QR_NOT_FOUND" } },
      ],
      approvalValid: true,
      beforeDeadline: true,
      minutesToDeadline: 47,
      confirmedSpend: sgd(3380),
      withinBudget: true,
      spendSettled: true,
      completedAt: null,
      complete: false,
      stop: null,
    });
  });

  it("completes once Spot C passes on its second attempt, at the time of that last pass", () => {
    const goal = evaluateGoal({
      ...input,
      spots: afterRecovery,
      now: at("16:44"),
      expenses: [...input.expenses, confirmed(400)],
    });
    expect(goal).toMatchObject({
      unresolved: [],
      complete: true,
      completedAt: at("16:43"),
      stop: "COMPLETED",
      confirmedSpend: sgd(3780),
    });
  });

  it("still completes an in-time 4 of 4 when the evaluation itself runs after the deadline", () => {
    const goal = evaluateGoal({ ...input, spots: afterRecovery, now: at("17:30") });
    expect(goal).toMatchObject({
      beforeDeadline: false,
      complete: true,
      completedAt: at("16:43"),
      stop: "COMPLETED",
    });
  });

  it("never counts a pass submitted after the deadline, so the campaign expires", () => {
    const lateC = spot("C", ["COMPLETED", "OPEN"], pass("17:01", 2));
    const spots = [placedA, placedB, lateC, placedD];
    expect(evaluateGoal({ ...input, spots, now: at("17:02") })).toMatchObject({
      passedSpotCodes: ["A", "B", "D"],
      complete: false,
      completedAt: null,
      stop: "EXPIRED_INCOMPLETE",
    });
  });

  it("completes when the last pass arrived exactly at the deadline", () => {
    const onTheDot = spot("C", ["COMPLETED", "OPEN"], pass("17:00", 2));
    const spots = [placedA, placedB, onTheDot, placedD];
    expect(evaluateGoal({ ...input, spots, now: deadline })).toMatchObject({
      complete: true,
      completedAt: deadline,
      minutesToDeadline: 0,
    });
  });

  it("gives every unresolved requirement the reason it is unresolved", () => {
    const spots = [
      spot("A", []),
      spot("B", ["OPEN"]),
      spot("C", ["OPEN"], fail("QR_WRONG_SPOT", "15:00")),
      spot("D", ["EXPIRED"]),
      spot("E", ["CANCELLED"]),
      spot("F", ["COMPLETED"]),
    ];
    expect(evaluateGoal({ ...input, spots }).unresolved).toEqual([
      { spotCode: "A", reason: { kind: "NOT_COMMISSIONED" } },
      { spotCode: "B", reason: { kind: "NO_EVIDENCE_YET" } },
      { spotCode: "C", reason: { kind: "EVIDENCE_FAILED", failure: "QR_WRONG_SPOT" } },
      { spotCode: "D", reason: { kind: "TASK_ENDED", failure: "TASK_EXPIRED" } },
      { spotCode: "E", reason: { kind: "TASK_ENDED", failure: "EXECUTOR_CANCELLED" } },
      { spotCode: "F", reason: { kind: "CLOSED_WITHOUT_PASS", lastFailure: null } },
    ]);
  });

  it("explains an open attempt with its own most recent failure, not an earlier attempt's", () => {
    const retried = spot(
      "C",
      ["COMPLETED", "OPEN"],
      fail("QR_NOT_FOUND", "15:00"),
      fail("LATE_EVIDENCE", "15:10"),
    );
    expect(evaluateGoal({ ...input, spots: [retried] }).unresolved).toEqual([
      { spotCode: "C", reason: { kind: "NO_EVIDENCE_YET" } },
    ]);
    const failedAgain = {
      ...retried,
      evidence: [...retried.evidence, fail("QR_WRONG_SPOT", "15:20", 2)],
    };
    expect(evaluateGoal({ ...input, spots: [failedAgain] }).unresolved).toEqual([
      { spotCode: "C", reason: { kind: "EVIDENCE_FAILED", failure: "QR_WRONG_SPOT" } },
    ]);
  });

  it("keeps a passed spot resolved when a later upload fails", () => {
    const spots = [spot("A", ["OPEN"], pass("15:00"), fail("QR_WRONG_SPOT", "15:05"))];
    expect(evaluateGoal({ ...input, spots })).toMatchObject({
      passedSpotCodes: ["A"],
      complete: true,
      completedAt: at("15:00"),
    });
  });

  it("lets the deadline win over an invalid approval or an overrun", () => {
    const expired = { ...input, now: at("17:30"), approvalValid: false };
    expect(evaluateGoal({ ...expired, expenses: [confirmed(6000)] }).stop).toBe(
      "EXPIRED_INCOMPLETE",
    );
  });

  it("stops at NEEDS_APPROVAL without a valid approval", () => {
    const goal = evaluateGoal({ ...input, spots: afterRecovery, approvalValid: false });
    expect(goal).toMatchObject({ complete: false, completedAt: null, stop: "NEEDS_APPROVAL" });
  });

  it("stops at NEEDS_APPROVAL when confirmed spend exceeds the approved budget", () => {
    const goal = evaluateGoal({ ...input, spots: afterRecovery, expenses: [confirmed(5001)] });
    expect(goal).toMatchObject({ withinBudget: false, complete: false, stop: "NEEDS_APPROVAL" });
  });

  it("measures spend from CONFIRMED expenses only", () => {
    const goal = evaluateGoal({ ...input, spots: afterRecovery, expenses: [confirmed(3780)] });
    expect(goal).toMatchObject({ confirmedSpend: sgd(3780), complete: true });
  });

  it("refuses to complete while any expense still waits for review or is disputed", () => {
    for (const status of ["SUBMITTED", "DISPUTED"] as const) {
      const expenses = [confirmed(3780), { amount: sgd(900), status }];
      expect(evaluateGoal({ ...input, spots: afterRecovery, expenses })).toMatchObject({
        confirmedSpend: sgd(3780),
        spendSettled: false,
        complete: false,
        completedAt: null,
        stop: null,
      });
    }
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
    const withFlag = firstPass.map((history) =>
      history.spotCode === "C" ? { ...history, inducedMiss: true } : history,
    );
    const withoutFlag = firstPass.map((history) =>
      history.spotCode === "C" ? { ...history, inducedMiss: false } : history,
    );
    expect(evaluateGoal({ ...input, spots: withFlag })).toEqual(
      evaluateGoal({ ...input, spots: withoutFlag }),
    );
    expect(evaluateGoal({ ...input, spots: withFlag })).toEqual(evaluateGoal(input));
  });
});

describe("spot outcomes", () => {
  it("marks a spot MISS on its first pass and PASS once its recovery passes", () => {
    expect(spotOutcome(missedC, deadline)).toBe("MISS");
    expect(firstPassOutcome(missedC, deadline)).toBe("MISS");
    expect(spotOutcome(recoveredC, deadline)).toBe("PASS");
    expect(firstPassOutcome(recoveredC, deadline)).toBe("MISS");
  });

  it("shows a spot PENDING while its recovery attempt is still open", () => {
    const recovering = spot("C", ["COMPLETED", "OPEN"], fail("QR_NOT_FOUND", "15:40"));
    expect(spotOutcome(recovering, deadline)).toBe("PENDING");
    expect(firstPassOutcome(recovering, deadline)).toBe("MISS");
  });

  it("keeps the first pass PENDING until the first attempt closes or passes", () => {
    expect(firstPassOutcome(spot("A", []), deadline)).toBe("PENDING");
    expect(firstPassOutcome(spot("A", ["OPEN"], fail("QR_NOT_FOUND", "15:00")), deadline)).toBe(
      "PENDING",
    );
    expect(firstPassOutcome(placed("A", "15:00"), deadline)).toBe("PASS");
  });

  it("does not let a pass after the deadline turn a spot PASS", () => {
    const late = spot("A", ["OPEN"], pass("17:05"));
    expect(spotOutcome(late, deadline)).toBe("PENDING");
    expect(firstPassOutcome(late, deadline)).toBe("PENDING");
  });

  it("treats every closing task status as a closed attempt", () => {
    expect(attemptStateOf("DISPATCHED")).toBe("OPEN");
    expect(attemptStateOf("SUBMITTED")).toBe("OPEN");
    expect(attemptStateOf("COMPLETED")).toBe("COMPLETED");
    expect(attemptStateOf("EXPIRED")).toBe("EXPIRED");
    expect(attemptStateOf("CANCELLED")).toBe("CANCELLED");
  });
});
