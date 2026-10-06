import { minutesUntil, type CampaignReceiptView } from "@datum/core";
import { formatMinutes, toMoney } from "@/lib/format";

export const isLive = (receipt: CampaignReceiptView): boolean =>
  receipt.status === "COMPLETED" && receipt.actual.spotsPassed === receipt.target.spots;

export const outcomeHeadline = (receipt: CampaignReceiptView): string =>
  isLive(receipt) ? "Campaign live" : "Ended before every spot was live";

export const withinBudget = (receipt: CampaignReceiptView): boolean =>
  toMoney(receipt.spend.remaining).amountMinor >= 0;

export const finishedEarly = (receipt: CampaignReceiptView): string | null => {
  const done = receipt.actual.completedAt;
  if (done === null) return null;
  return `${formatMinutes(minutesUntil(done, receipt.target.deadline))} before the deadline`;
};

export const explorerTx = (hash: string): string =>
  `https://preprod.cardanoscan.io/transaction/${encodeURIComponent(hash)}`;

export function atomicToToken(atomic: string, decimals: number): string {
  const digits = atomic.replace(/^0+(?=\d)/, "").padStart(decimals + 1, "0");
  const whole = digits.slice(0, -decimals);
  const fraction = digits.slice(-decimals).replace(/0+$/, "");
  return fraction.length === 0 ? whole : `${whole}.${fraction}`;
}
