export const appRoutes = {
  landing: "/",
  newCampaign: "/campaigns/new",
} as const;

export const campaignHref = (campaignId: string): string =>
  `/campaigns/${encodeURIComponent(campaignId)}`;
