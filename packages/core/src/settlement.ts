import type { CampaignReceipt } from "./contract";

export const settlementRefusals = [
  "NOT_COMPLETED",
  "SPOTS_UNRESOLVED",
  "OVER_BUDGET",
  "RECEIPT_ALTERED",
  "RESULT_NOT_BOUND",
] as const;
export type SettlementRefusal = (typeof settlementRefusals)[number];

export interface SettlementClaim {
  readonly receipt: CampaignReceipt;
  readonly recordedSha256: string;
  readonly computedSha256: string;
  readonly resultText: string | null;
}

export type SettlementVerdict =
  | { readonly outcome: "SETTLE" }
  | { readonly outcome: "REFUSE"; readonly reason: SettlementRefusal };

export const receiptBinding = (sha256: string): string => `Campaign Receipt sha256 ${sha256}`;

const refuse = (reason: SettlementRefusal): SettlementVerdict => ({ outcome: "REFUSE", reason });

const everySpotLive = ({ target, actual, spots }: CampaignReceipt): boolean =>
  spots.length === target.spots &&
  actual.spotsPassed === target.spots &&
  spots.every((spot) => spot.final === "PASS");

const withinBudget = ({ target, actual }: CampaignReceipt): boolean =>
  actual.spend.amountMinor <= target.budget.amountMinor;

export function settlementVerdict(claim: SettlementClaim): SettlementVerdict {
  const { receipt, recordedSha256, computedSha256, resultText } = claim;
  if (receipt.status !== "COMPLETED") return refuse("NOT_COMPLETED");
  if (!everySpotLive(receipt)) return refuse("SPOTS_UNRESOLVED");
  if (!withinBudget(receipt)) return refuse("OVER_BUDGET");
  if (computedSha256.toLowerCase() !== recordedSha256.toLowerCase()) {
    return refuse("RECEIPT_ALTERED");
  }
  if (resultText !== null && !resultText.includes(receiptBinding(recordedSha256))) {
    return refuse("RESULT_NOT_BOUND");
  }
  return { outcome: "SETTLE" };
}
