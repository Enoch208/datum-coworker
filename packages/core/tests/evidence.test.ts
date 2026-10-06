import { describe, expect, it } from "vitest";
import { evaluateEvidence, type EvidenceContext, type EvidenceSubmission } from "../src/evidence";

const baseUrl = "https://datum.example";
const campaignId = "cmp_7k2m9q4w8z1x3c5v";
const spotUrl = (code: string, id = campaignId) => `${baseUrl}/c/${id}/${code}`;

const context: EvidenceContext = {
  expected: { campaignId, spotCode: "C" },
  qrBaseUrl: baseUrl,
  taskDueBy: "2026-10-07T16:45:00+08:00",
  campaignDeadline: "2026-10-07T17:00:00+08:00",
  taskCancelled: false,
  taskExpired: false,
};

const onTimeSpotC: EvidenceSubmission = {
  photoPresent: true,
  decodedQrText: spotUrl("C"),
  submittedAt: "2026-10-07T16:38:00+08:00",
  belongsToOpenTask: true,
};

const allChecks = {
  photoPresent: true,
  qrDecodable: true,
  qrMatchesCampaign: true,
  qrMatchesSpot: true,
  taskOpen: true,
  beforeDeadline: true,
};

const lateSpotC: EvidenceSubmission = { ...onTimeSpotC, submittedAt: "2026-10-07T16:52:00+08:00" };

const failureOf = (
  submission: EvidenceSubmission | null,
  overrides: Partial<EvidenceContext> = {},
) => evaluateEvidence(submission, { ...context, ...overrides }).failure;

describe("evaluateEvidence", () => {
  it("passes Spot C's own QR photographed inside the window", () => {
    expect(evaluateEvidence(onTimeSpotC, context)).toEqual({
      verdict: "PASS",
      failure: null,
      checks: allChecks,
      decoded: { campaignId, spotCode: "C" },
    });
  });

  it("treats evidence submitted exactly at the due time as on time", () => {
    expect(failureOf({ ...onTimeSpotC, submittedAt: "2026-10-07T16:45:00+08:00" })).toBeNull();
  });

  it("fails LATE_EVIDENCE even when the QR matches", () => {
    expect(evaluateEvidence(lateSpotC, context)).toEqual({
      verdict: "FAIL",
      failure: "LATE_EVIDENCE",
      checks: { ...allChecks, beforeDeadline: false },
      decoded: { campaignId, spotCode: "C" },
    });
  });

  it("closes the window at the campaign deadline when it comes before the task due time", () => {
    const deadlineFirst = { taskDueBy: "2026-10-07T17:30:00+08:00" };
    const afterDeadline = { ...onTimeSpotC, submittedAt: "2026-10-07T17:01:00+08:00" };
    expect(failureOf(afterDeadline, deadlineFirst)).toBe("LATE_EVIDENCE");
  });

  it("ranks LATE_EVIDENCE first, above cancellation, expiry and QR failures", () => {
    const lateWrongSpot = { ...lateSpotC, decodedQrText: spotUrl("B") };
    expect(failureOf(lateWrongSpot, { taskCancelled: true, taskExpired: true })).toBe(
      "LATE_EVIDENCE",
    );
  });

  it("ranks EXECUTOR_CANCELLED second, above expiry and missing evidence", () => {
    expect(failureOf(null, { taskCancelled: true, taskExpired: true })).toBe("EXECUTOR_CANCELLED");
    expect(failureOf(onTimeSpotC, { taskCancelled: true })).toBe("EXECUTOR_CANCELLED");
  });

  it("ranks TASK_EXPIRED third, above missing evidence", () => {
    expect(failureOf(null, { taskExpired: true })).toBe("TASK_EXPIRED");
    expect(failureOf(onTimeSpotC, { taskExpired: true })).toBe("TASK_EXPIRED");
  });

  it("ranks NO_EVIDENCE fourth: no submission, no photo, or an upload for another task", () => {
    expect(failureOf(null)).toBe("NO_EVIDENCE");
    expect(failureOf({ ...onTimeSpotC, photoPresent: false })).toBe("NO_EVIDENCE");
    expect(failureOf({ ...onTimeSpotC, belongsToOpenTask: false })).toBe("NO_EVIDENCE");
  });

  it("ranks QR_NOT_FOUND fifth: nothing decoded, or a QR that is not a Datum spot URL", () => {
    expect(failureOf({ ...onTimeSpotC, decodedQrText: null })).toBe("QR_NOT_FOUND");
    expect(failureOf({ ...onTimeSpotC, decodedQrText: "https://cafe.example/menu" })).toBe(
      "QR_NOT_FOUND",
    );
  });

  it("ranks QR_WRONG_CAMPAIGN sixth, above a spot mismatch", () => {
    const otherCampaignSpotB = spotUrl("B", "cmp_0000000000000000");
    expect(failureOf({ ...onTimeSpotC, decodedQrText: otherCampaignSpotB })).toBe(
      "QR_WRONG_CAMPAIGN",
    );
  });

  it("ranks QR_WRONG_SPOT last: Spot B's card photographed for Spot C", () => {
    expect(evaluateEvidence({ ...onTimeSpotC, decodedQrText: spotUrl("B") }, context)).toEqual({
      verdict: "FAIL",
      failure: "QR_WRONG_SPOT",
      checks: { ...allChecks, qrMatchesSpot: false },
      decoded: { campaignId, spotCode: "B" },
    });
  });

  it("reports every check as false when nothing was submitted", () => {
    expect(evaluateEvidence(null, context).checks).toEqual({
      photoPresent: false,
      qrDecodable: false,
      qrMatchesCampaign: false,
      qrMatchesSpot: false,
      taskOpen: false,
      beforeDeadline: false,
    });
  });

  it.each([
    ["NO_EVIDENCE", { ...onTimeSpotC, belongsToOpenTask: false }, {}, "taskOpen"],
    ["QR_NOT_FOUND", { ...onTimeSpotC, decodedQrText: null }, {}, "qrDecodable"],
    [
      "QR_WRONG_CAMPAIGN",
      { ...onTimeSpotC, decodedQrText: spotUrl("C", "cmp_0000000000000000") },
      {},
      "qrMatchesCampaign",
    ],
    ["QR_WRONG_SPOT", { ...onTimeSpotC, decodedQrText: spotUrl("B") }, {}, "qrMatchesSpot"],
    ["LATE_EVIDENCE", lateSpotC, {}, "beforeDeadline"],
    ["EXECUTOR_CANCELLED", onTimeSpotC, { taskCancelled: true }, "taskOpen"],
    ["TASK_EXPIRED", onTimeSpotC, { taskExpired: true }, "taskOpen"],
  ] as const)("marks the failing check for %s", (failure, submission, overrides, failing) => {
    const evaluation = evaluateEvidence(submission, { ...context, ...overrides });
    expect(evaluation.failure).toBe(failure);
    expect(evaluation.checks[failing]).toBe(false);
  });

  it("keeps the campaign check true when only the spot is wrong", () => {
    const checks = evaluateEvidence(
      { ...onTimeSpotC, decodedQrText: spotUrl("B") },
      context,
    ).checks;
    expect(checks).toMatchObject({ qrMatchesCampaign: true, qrMatchesSpot: false });
  });

  it("treats a QR that is not a Datum spot URL as no spot code at all", () => {
    const evaluation = evaluateEvidence(
      { ...onTimeSpotC, decodedQrText: "https://cafe.example/menu" },
      context,
    );
    expect(evaluation).toMatchObject({ decoded: null, checks: { qrDecodable: false } });
  });

  it("never produces ADVISORY_REVIEW_REQUIRED from the deterministic checks", () => {
    const inputs = [null, onTimeSpotC, lateSpotC, { ...onTimeSpotC, decodedQrText: null }];
    for (const submission of inputs) {
      expect(failureOf(submission)).not.toBe("ADVISORY_REVIEW_REQUIRED");
    }
  });
});
