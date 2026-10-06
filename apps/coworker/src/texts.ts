import type { CampaignView, WireMoney } from "@datum/core";

const singaporeOffsetMs = 8 * 3_600_000;

export const singaporeTime = (instant: Date | string): string => {
  const shifted = new Date(new Date(instant).getTime() + singaporeOffsetMs).toISOString();
  return `${shifted.slice(0, 10)} ${shifted.slice(11, 16)} SGT`;
};

const wireMoney = (money: WireMoney): string => `${money.currency} ${money.amount}`;

export const campaignPageUrl = (appBaseUrl: string, campaignId: string): string =>
  `${appBaseUrl}/campaigns/${campaignId}`;

export const canonicalReceiptUrl = (appBaseUrl: string, campaignId: string): string =>
  `${appBaseUrl}/api/campaigns/${campaignId}/receipt/canonical`;

export function proposalComment(view: CampaignView, appBaseUrl: string): string {
  const spots = view.spots.map((spot) => `${spot.code} ${spot.name}`).join("; ");
  const estimate =
    view.proposal === null
      ? `a ${wireMoney(view.budget)} budget`
      : `an estimated ${wireMoney(view.proposal.estimatedSpend)} of the ${wireMoney(view.budget)} budget`;
  const headline = view.proposal === null ? "" : ` Card headline: ${view.proposal.copy.headline}.`;
  const count = view.spots.length === 1 ? "1 spot" : `${String(view.spots.length)} spots`;
  return [
    `Datum drafted your campaign. Review and approve it once here: ${campaignPageUrl(appBaseUrl, view.id)}`,
    "",
    `${view.brand.name}: ${count} (${spots}), every card up by ${singaporeTime(view.deadline)}, ${estimate}.${headline} Nothing is printed or placed until you approve, and Datum starts the physical work only once the payment for this Task is confirmed in escrow.`,
  ].join("\n");
}

export function inputRequestComment(missing: readonly string[]): string {
  return [
    "Datum needs a few more details before it can plan this campaign:",
    ...missing.map((item) => `- ${item}`),
    "",
    "Reply on this Task with the details and set it back to Ready. Datum reads the description and your replies again and drafts the campaign.",
  ].join("\n");
}

export function notLaunchedComment(approved: boolean, deadline: Date): string {
  const reason = approved ? "it was approved but did not start" : "it was not approved";
  return `Datum did not run this campaign: ${reason} before its deadline (${singaporeTime(deadline)}). No cards were printed or placed and nothing was spent. Datum submitted no result for this Task's payment, so it does not claim it.`;
}
