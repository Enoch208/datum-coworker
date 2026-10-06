import { confirmedSpend, type LedgerExpense } from "./budget";
import {
  executorAdapters,
  type ApprovalLock,
  type CampaignReceipt,
  type CampaignStatus,
  type ExecutorAdapter,
  type IsoTimestamp,
  type MasumiPaymentEvidence,
  type Money,
  type ReceiptIntervention,
  type ReceiptRecovery,
  type ReceiptSpendLine,
  type SpotReceiptLine,
} from "./contract";
import { compareMoney, sumMoney } from "./money";
import { compareSpotCodes } from "./qr";
import { isAfter } from "./time";

export type ReceiptErrorCode =
  "INCONSISTENT_COMPLETION" | "INCONSISTENT_SPEND" | "UNVERIFIED_COLLECTION" | "INVALID_COUNT";

export class ReceiptError extends Error {
  readonly code: ReceiptErrorCode;

  constructor(code: ReceiptErrorCode, message: string) {
    super(message);
    this.name = "ReceiptError";
    this.code = code;
  }
}

export interface ReceiptFacts {
  campaignName: string;
  status: CampaignStatus;
  approval: ApprovalLock;
  spots: readonly SpotReceiptLine[];
  expenses: readonly LedgerExpense[];
  completedAt: IsoTimestamp | null;
  adaptersUsed: readonly ExecutorAdapter[];
  firstApprovedAt: IsoTimestamp;
  interventions: readonly ReceiptIntervention[];
  recoveries: readonly ReceiptRecovery[];
  spendLines: readonly ReceiptSpendLine[];
  masumi: MasumiPaymentEvidence | null;
}

const isCount = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

const assertCounts = (spots: readonly SpotReceiptLine[]): void => {
  const invalid = spots.find((spot) => !isCount(spot.scans) || !isCount(spot.attempts));
  if (invalid !== undefined) {
    throw new ReceiptError("INVALID_COUNT", `Spot ${invalid.spotCode} has an invalid count`);
  }
};

const assertVerifiedCollection = (masumi: MasumiPaymentEvidence | null): void => {
  if (masumi?.collectionConfirmed !== true) return;
  if (masumi.collectionTxHash === null || masumi.verifiedAt === null) {
    throw new ReceiptError(
      "UNVERIFIED_COLLECTION",
      "A collection is confirmed only with a checked tx hash and verification time",
    );
  }
};

const completedHonestly = (facts: ReceiptFacts, spend: Money): boolean =>
  facts.completedAt !== null &&
  !isAfter(facts.completedAt, facts.approval.deadline) &&
  facts.spots.length > 0 &&
  facts.spots.every((spot) => spot.final === "PASS") &&
  compareMoney(spend, facts.approval.budget) <= 0;

const assertConsistentCompletion = (facts: ReceiptFacts, spend: Money): void => {
  const consistent =
    facts.status === "COMPLETED" ? completedHonestly(facts, spend) : facts.completedAt === null;
  if (!consistent) {
    throw new ReceiptError(
      "INCONSISTENT_COMPLETION",
      `Facts do not support a ${facts.status} receipt with completedAt ${String(facts.completedAt)}`,
    );
  }
};

const copyLine = (spot: SpotReceiptLine): SpotReceiptLine => ({
  spotCode: spot.spotCode,
  name: spot.name,
  firstPass: spot.firstPass,
  final: spot.final,
  attempts: spot.attempts,
  inducedMiss: spot.inducedMiss,
  scans: spot.scans,
  evidencePhotoUrl: spot.evidencePhotoUrl,
  passedAt: spot.passedAt,
});

const assertSpendLines = (facts: ReceiptFacts, spend: Money): void => {
  const listed = sumMoney(
    facts.spendLines.map((line) => line.amount),
    spend.currency,
  );
  if (compareMoney(listed, spend) !== 0) {
    throw new ReceiptError(
      "INCONSISTENT_SPEND",
      `The spend lines add up to ${String(listed.amountMinor)} but confirmed spend is ${String(spend.amountMinor)}`,
    );
  }
};

const afterApproval = (facts: ReceiptFacts): ReceiptIntervention[] =>
  facts.interventions
    .filter((intervention) => !isAfter(facts.firstApprovedAt, intervention.at))
    .map((intervention) => ({ ...intervention }));

const copyRecovery = (recovery: ReceiptRecovery): ReceiptRecovery => ({
  ...recovery,
  spotCodes: [...recovery.spotCodes],
  tasks: recovery.tasks.map((task) => ({ ...task })),
  estimatedCost: { ...recovery.estimatedCost },
});

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

const countWhere = <T>(items: readonly T[], predicate: (item: T) => boolean): number =>
  items.filter(predicate).length;

export const buildReceipt = (facts: ReceiptFacts): CampaignReceipt => {
  assertCounts(facts.spots);
  assertVerifiedCollection(facts.masumi);
  const spend = confirmedSpend(facts.expenses, facts.approval.budget.currency);
  assertConsistentCompletion(facts, spend);
  assertSpendLines(facts, spend);
  const interventions = afterApproval(facts);
  const spots = [...facts.spots]
    .sort((left, right) => compareSpotCodes(left.spotCode, right.spotCode))
    .map(copyLine);
  return {
    campaignId: facts.approval.campaignId,
    campaignName: facts.campaignName,
    status: facts.status,
    target: {
      spots: spots.length,
      deadline: facts.approval.deadline,
      budget: { ...facts.approval.budget },
    },
    actual: {
      spotsPassed: countWhere(spots, (spot) => spot.final === "PASS"),
      completedAt: facts.completedAt,
      spend,
    },
    spots,
    firstPassPassed: countWhere(spots, (spot) => spot.firstPass === "PASS"),
    recoveryActions: sum(spots.map((spot) => Math.max(0, spot.attempts - 1))),
    recoveries: facts.recoveries.map(copyRecovery),
    postApprovalInterventions: interventions.length,
    interventions,
    spendLines: facts.spendLines.map((line) => ({ ...line, amount: { ...line.amount } })),
    executorAdapters: executorAdapters.filter((adapter) => facts.adaptersUsed.includes(adapter)),
    totalScans: sum(spots.map((spot) => spot.scans)),
    masumi: facts.masumi === null ? null : { ...facts.masumi },
  };
};
