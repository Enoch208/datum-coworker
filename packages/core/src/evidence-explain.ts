import type { EvidenceEvaluation, EvidenceFailure, QrPayload } from "./contract";

const spot = (payload: QrPayload): string => `Spot ${payload.spotCode}`;

type Explainer = (evaluation: EvidenceEvaluation, expected: QrPayload) => string;

const failureExplainers: Readonly<Record<EvidenceFailure, Explainer>> = {
  NO_EVIDENCE: (evaluation, expected) =>
    evaluation.checks.photoPresent
      ? `This photo does not belong to an open ${spot(expected)} task, so it cannot count.`
      : `No photo was received for ${spot(expected)}.`,
  QR_NOT_FOUND: (_evaluation, expected) =>
    `No Datum spot code could be read in this photo. Retake it with ${spot(expected)}'s whole QR code in frame and in focus.`,
  QR_WRONG_CAMPAIGN: (_evaluation, expected) =>
    `This photo shows a code from another campaign, not ${spot(expected)}'s.`,
  QR_WRONG_SPOT: (evaluation, expected) =>
    evaluation.decoded === null
      ? `This photo does not show ${spot(expected)}'s code.`
      : `This photo shows ${spot(evaluation.decoded)}'s code, not ${spot(expected)}'s.`,
  LATE_EVIDENCE: (_evaluation, expected) =>
    `This photo of ${spot(expected)} arrived after the task was due, so it is kept for the record but cannot count.`,
  EXECUTOR_CANCELLED: (_evaluation, expected) =>
    `The ${spot(expected)} task was cancelled, so this photo is kept for the record but cannot count.`,
  TASK_EXPIRED: (_evaluation, expected) =>
    `The ${spot(expected)} task had expired, so this photo is kept for the record but cannot count.`,
  ADVISORY_REVIEW_REQUIRED: (_evaluation, expected) =>
    `This photo of ${spot(expected)} needs a person to review it before it can count.`,
};

export const explainEvidence = (evaluation: EvidenceEvaluation, expected: QrPayload): string =>
  evaluation.failure === null
    ? `This photo shows ${spot(expected)}'s code for this campaign and arrived in time.`
    : failureExplainers[evaluation.failure](evaluation, expected);
