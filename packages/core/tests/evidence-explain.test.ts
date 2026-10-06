import { describe, expect, it } from "vitest";
import { evaluateEvidence, type EvidenceContext, type EvidenceSubmission } from "../src/evidence";
import { evidenceCheckView, explainEvidence } from "../src/evidence-explain";
import type { EvidenceCheckView } from "../src/wire";

const baseUrl = "https://datum.example";
const campaignId = "cmp_7k2m9q4w8z1x3c5v";
const expected = { campaignId, spotCode: "C" };

const context: EvidenceContext = {
  expected,
  qrBaseUrl: baseUrl,
  taskDueBy: "2026-10-07T17:00:00+08:00",
  campaignDeadline: "2026-10-07T17:00:00+08:00",
  taskCancelled: false,
  taskExpired: false,
};

const photo = (decodedQrText: string | null): EvidenceSubmission => ({
  photoPresent: true,
  decodedQrText,
  submittedAt: "2026-10-07T16:00:00+08:00",
  belongsToOpenTask: true,
});

const explain = (submission: EvidenceSubmission | null, overrides: Partial<EvidenceContext> = {}) =>
  explainEvidence(evaluateEvidence(submission, { ...context, ...overrides }), expected);

describe("explainEvidence", () => {
  it("names the spot a passing photo proves", () => {
    expect(explain(photo(`${baseUrl}/c/${campaignId}/C`))).toBe(
      "This photo shows Spot C's code for this campaign and arrived in time.",
    );
  });

  it("names both spots when the photo shows the wrong one", () => {
    expect(explain(photo(`${baseUrl}/c/${campaignId}/B`))).toBe(
      "This photo shows Spot B's code, not Spot C's.",
    );
  });

  it("says a code from another campaign is not this spot's", () => {
    expect(explain(photo(`${baseUrl}/c/cmp_0000000000000000/C`))).toBe(
      "This photo shows a code from another campaign, not Spot C's.",
    );
  });

  it("tells the runner how to retake a photo with no readable code", () => {
    expect(explain(photo(null))).toBe(
      "No Datum spot code could be read in this photo. Retake it with Spot C's whole QR code in frame and in focus.",
    );
  });

  it("keeps late, cancelled and expired photos for the record without counting them", () => {
    const late = {
      ...photo(`${baseUrl}/c/${campaignId}/C`),
      submittedAt: "2026-10-07T17:01:00+08:00",
    };
    expect(explain(late)).toBe(
      "This photo of Spot C arrived after the task was due, so it is kept for the record but cannot count.",
    );
    expect(explain(photo(null), { taskCancelled: true })).toMatch(/^The Spot C task was cancelled/);
    expect(explain(photo(null), { taskExpired: true })).toMatch(/^The Spot C task had expired/);
  });

  it("separates a missing photo from a photo for a closed task", () => {
    expect(explain(null)).toBe("No photo was received for Spot C.");
    expect(explain({ ...photo(null), belongsToOpenTask: false })).toBe(
      "This photo does not belong to an open Spot C task, so it cannot count.",
    );
  });
});

describe("evidenceCheckView", () => {
  const view = (submission: EvidenceSubmission | null, overrides: Partial<EvidenceContext> = {}) =>
    evidenceCheckView(evaluateEvidence(submission, { ...context, ...overrides }).checks);
  const spotLink = (code: string, id = campaignId) => `${baseUrl}/c/${id}/${code}`;

  it("shows every check passing for a passing photo", () => {
    expect(view(photo(spotLink("C")))).toEqual({
      photoReceived: true,
      qrDetected: true,
      campaignMatches: true,
      spotMatches: true,
      taskOpen: true,
      beforeDeadline: true,
    });
  });

  it.each<[string, EvidenceSubmission | null, Partial<EvidenceContext>, keyof EvidenceCheckView]>([
    ["NO_EVIDENCE", null, {}, "photoReceived"],
    ["NO_EVIDENCE", { ...photo(spotLink("C")), belongsToOpenTask: false }, {}, "taskOpen"],
    ["QR_NOT_FOUND", photo(null), {}, "qrDetected"],
    ["QR_WRONG_CAMPAIGN", photo(spotLink("C", "cmp_0000000000000000")), {}, "campaignMatches"],
    ["QR_WRONG_SPOT", photo(spotLink("B")), {}, "spotMatches"],
    [
      "LATE_EVIDENCE",
      { ...photo(spotLink("C")), submittedAt: "2026-10-07T17:01:00+08:00" },
      {},
      "beforeDeadline",
    ],
    ["EXECUTOR_CANCELLED", photo(spotLink("C")), { taskCancelled: true }, "taskOpen"],
    ["TASK_EXPIRED", photo(spotLink("C")), { taskExpired: true }, "taskOpen"],
  ])("maps %s to a false %s check", (failure, submission, overrides, failing) => {
    const evaluation = evaluateEvidence(submission, { ...context, ...overrides });
    expect(evaluation.failure).toBe(failure);
    expect(evidenceCheckView(evaluation.checks)[failing]).toBe(false);
  });

  it("keeps the campaign check true when only the spot is wrong", () => {
    expect(view(photo(spotLink("B")))).toMatchObject({ campaignMatches: true, spotMatches: false });
  });
});
