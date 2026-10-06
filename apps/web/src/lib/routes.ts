export const appRoutes = {
  landing: "/",
  newCampaign: "/campaigns/new",
} as const;

export const campaignHref = (campaignId: string): string =>
  `/campaigns/${encodeURIComponent(campaignId)}`;

export const runnerHref = (token: string): string => `/r/${encodeURIComponent(token)}`;

export const runnerTaskHref = (token: string, taskId: string): string =>
  `${runnerHref(token)}/tasks/${encodeURIComponent(taskId)}`;
