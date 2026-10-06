import {
  buildSpotQrUrl,
  evaluateEvidence,
  explainEvidence,
  parseSpotQrUrl,
  type EvidenceEvaluation,
  type QrPayload,
} from "@datum/core";
import { isOpenForWork, type RunnerTask } from "../runners/tasks";

export interface JudgedPhoto {
  readonly expected: QrPayload;
  readonly evaluation: EvidenceEvaluation;
  readonly explanation: string;
}

export const isSpotLinkFor =
  (appBaseUrl: string) =>
  (text: string): boolean =>
    parseSpotQrUrl(appBaseUrl, text) !== null;

export const shownCode = (texts: readonly string[], expectedText: string): string | null =>
  texts.find((text) => text !== expectedText) ?? texts[0] ?? null;

export function judgePhoto(
  target: RunnerTask,
  decodedTexts: readonly string[],
  receivedAt: Date,
  appBaseUrl: string,
): JudgedPhoto {
  const { task, spot, campaign } = target;
  if (spot === null) throw new Error(`Task ${task.id} is not a placement`);
  const expected = { campaignId: campaign.id, spotCode: spot.code };
  const evaluation = evaluateEvidence(
    {
      photoPresent: true,
      decodedQrText: shownCode(decodedTexts, buildSpotQrUrl(appBaseUrl, expected)),
      submittedAt: receivedAt.toISOString(),
      belongsToOpenTask: isOpenForWork(task),
    },
    {
      expected,
      qrBaseUrl: appBaseUrl,
      taskDueBy: task.dueBy.toISOString(),
      campaignDeadline: campaign.deadline.toISOString(),
      taskCancelled: task.status === "CANCELLED",
      taskExpired: task.status === "EXPIRED",
    },
  );
  return { expected, evaluation, explanation: explainEvidence(evaluation, expected) };
}
