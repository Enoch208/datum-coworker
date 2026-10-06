import type { SpotCode } from "./contract";
import { compareSpotCodes, isCampaignId, isSpotCode } from "./qr";

export interface SpotAttempt {
  spotCode: SpotCode;
  attempt: number;
}

export interface TaskCoverage {
  idempotencyKey: string;
  spotCodes: readonly SpotCode[];
  open: boolean;
}

const assertCampaignId = (campaignId: string): void => {
  if (!isCampaignId(campaignId)) {
    throw new RangeError(`Campaign id cannot appear in a recovery key: ${campaignId}`);
  }
};

const attemptSegment = (attempt: number): string => {
  if (!Number.isSafeInteger(attempt) || attempt < 1) {
    throw new RangeError(`Attempt must be a positive integer: ${String(attempt)}`);
  }
  return `attempt:${String(attempt)}`;
};

const spotSegment = ({ spotCode, attempt }: SpotAttempt): string => {
  if (!isSpotCode(spotCode)) throw new RangeError(`Not a spot code: ${spotCode}`);
  return `spot:${spotCode}:${attemptSegment(attempt)}`;
};

export const recoveryKey = (campaignId: string, spotCode: SpotCode, attempt: number): string => {
  assertCampaignId(campaignId);
  return `campaign:${campaignId}:${spotSegment({ spotCode, attempt })}`;
};

export const printKey = (campaignId: string, attempt: number): string => {
  assertCampaignId(campaignId);
  return `campaign:${campaignId}:print:${attemptSegment(attempt)}`;
};

const bySpotCode = (left: SpotAttempt, right: SpotAttempt): number =>
  compareSpotCodes(left.spotCode, right.spotCode);

export const actionKey = (campaignId: string, coverage: readonly SpotAttempt[]): string => {
  assertCampaignId(campaignId);
  const spotCodes = new Set(coverage.map((covered) => covered.spotCode));
  if (coverage.length === 0 || spotCodes.size !== coverage.length) {
    throw new RangeError("An action must cover at least one spot, each spot once");
  }
  const segments = [...coverage].sort(bySpotCode).map(spotSegment);
  return `campaign:${campaignId}:${segments.join("+")}`;
};

export const nextAttempt = (tasks: readonly TaskCoverage[], spotCode: SpotCode): number =>
  tasks.filter((task) => !task.open && task.spotCodes.includes(spotCode)).length + 1;
