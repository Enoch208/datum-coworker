import type {
  EvidenceChecks,
  EvidenceEvaluation,
  EvidenceFailure,
  IsoTimestamp,
  QrPayload,
} from "./contract";
import { parseSpotQrUrl } from "./qr";
import { earlierOf, isAfter } from "./time";

export interface EvidenceSubmission {
  photoPresent: boolean;
  decodedQrText: string | null;
  submittedAt: IsoTimestamp;
  belongsToOpenTask: boolean;
}

export interface EvidenceContext {
  expected: QrPayload;
  qrBaseUrl: string;
  taskDueBy: IsoTimestamp;
  campaignDeadline: IsoTimestamp;
  taskCancelled: boolean;
  taskExpired: boolean;
}

const decodedPayload = (
  submission: EvidenceSubmission | null,
  context: EvidenceContext,
): QrPayload | null =>
  submission?.decodedQrText == null
    ? null
    : parseSpotQrUrl(context.qrBaseUrl, submission.decodedQrText);

const submittedInWindow = (submission: EvidenceSubmission, context: EvidenceContext): boolean =>
  !isAfter(submission.submittedAt, earlierOf(context.taskDueBy, context.campaignDeadline));

const matchesExpected = (decoded: QrPayload | null, expected: QrPayload): boolean =>
  decoded?.campaignId === expected.campaignId && decoded.spotCode === expected.spotCode;

const checksFor = (
  submission: EvidenceSubmission | null,
  context: EvidenceContext,
  decoded: QrPayload | null,
): EvidenceChecks => ({
  photoPresent: submission?.photoPresent === true,
  qrDecodable: decoded !== null,
  qrMatchesCampaign: decoded?.campaignId === context.expected.campaignId,
  qrMatchesSpot: matchesExpected(decoded, context.expected),
  taskOpen:
    submission?.belongsToOpenTask === true && !context.taskCancelled && !context.taskExpired,
  beforeDeadline: submission !== null && submittedInWindow(submission, context),
});

const isUsableUpload = (submission: EvidenceSubmission | null): boolean =>
  submission?.photoPresent === true && submission.belongsToOpenTask;

const qrFailure = (decoded: QrPayload | null, expected: QrPayload): EvidenceFailure | null => {
  if (decoded === null) return "QR_NOT_FOUND";
  if (decoded.campaignId !== expected.campaignId) return "QR_WRONG_CAMPAIGN";
  if (decoded.spotCode !== expected.spotCode) return "QR_WRONG_SPOT";
  return null;
};

const firstFailure = (
  submission: EvidenceSubmission | null,
  context: EvidenceContext,
  checks: EvidenceChecks,
  decoded: QrPayload | null,
): EvidenceFailure | null => {
  if (checks.photoPresent && !checks.beforeDeadline) return "LATE_EVIDENCE";
  if (context.taskCancelled) return "EXECUTOR_CANCELLED";
  if (context.taskExpired) return "TASK_EXPIRED";
  if (!isUsableUpload(submission)) return "NO_EVIDENCE";
  return qrFailure(decoded, context.expected);
};

export const evaluateEvidence = (
  submission: EvidenceSubmission | null,
  context: EvidenceContext,
): EvidenceEvaluation => {
  const decoded = decodedPayload(submission, context);
  const checks = checksFor(submission, context, decoded);
  const failure = firstFailure(submission, context, checks, decoded);
  return { verdict: failure === null ? "PASS" : "FAIL", failure, checks, decoded };
};
