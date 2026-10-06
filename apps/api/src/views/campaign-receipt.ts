import {
  subtractMoney,
  toWireMoney,
  type CampaignReceipt,
  type CampaignReceiptView,
  type ExecutorAdapter,
  type MasumiPaymentEvidence,
} from "@datum/core";
import type { CampaignReceiptRow } from "@datum/db";
import { campaignReceiptSchema } from "./receipt-schema";

export const executorLabels: Readonly<Record<ExecutorAdapter, string>> = {
  LOCAL_ENROLLED_RUNNER: "Local enrolled runner",
  RENTAHUMAN: "RentAHuman",
};

export const parseStoredReceipt = (row: CampaignReceiptRow): CampaignReceipt => {
  const json: unknown = JSON.parse(row.canonicalJson);
  return campaignReceiptSchema.parse(json);
};

export function toCampaignReceiptView(
  row: CampaignReceiptRow,
  payment: MasumiPaymentEvidence | null = null,
): CampaignReceiptView {
  const receipt = parseStoredReceipt(row);
  const { target, actual } = receipt;
  return {
    campaignId: receipt.campaignId,
    campaignName: receipt.campaignName,
    status: receipt.status,
    target: { ...target, budget: toWireMoney(target.budget) },
    actual: { ...actual, spend: toWireMoney(actual.spend) },
    firstPass: { passed: receipt.firstPassPassed, required: target.spots },
    spots: receipt.spots.map((spot) => ({
      ...spot,
      recoveredAfterMiss: spot.firstPass === "MISS" && spot.final === "PASS",
    })),
    recoveryActions: receipt.recoveryActions,
    recoveries: receipt.recoveries.map((recovery) => ({
      ...recovery,
      estimatedCost: toWireMoney(recovery.estimatedCost),
    })),
    postApprovalInterventions: receipt.postApprovalInterventions,
    interventions: receipt.interventions,
    spend: {
      budget: toWireMoney(target.budget),
      confirmed: toWireMoney(actual.spend),
      remaining: toWireMoney(subtractMoney(target.budget, actual.spend)),
      lines: receipt.spendLines.map((line) => ({ ...line, amount: toWireMoney(line.amount) })),
    },
    executors: receipt.executorAdapters.map((adapter) => ({
      adapter,
      label: executorLabels[adapter],
    })),
    totalScans: receipt.totalScans,
    publishedAt: row.publishedAt.toISOString(),
    sha256: row.sha256,
    masumi: receipt.masumi ?? payment,
  };
}
