import type {
  ApproveCampaignRequest,
  CampaignView,
  CreateCampaignRequest,
  EditCopyRequest,
  TimelineEventView,
} from "@datum/core";
import { expectShape, send } from "./http";
import { campaignViewSchema, createdCampaignSchema, timelineSchema } from "./wire-schemas";

const campaignPath = (id: string): string => `/campaigns/${encodeURIComponent(id)}`;

const json = (body: unknown): string => JSON.stringify(body);

export async function createCampaign(request: CreateCampaignRequest): Promise<string> {
  const body = await send("/campaigns", { method: "POST", body: json(request) });
  return expectShape(createdCampaignSchema, body, "the new campaign").id;
}

export async function getCampaign(id: string, signal: AbortSignal): Promise<CampaignView> {
  const body = await send(campaignPath(id), { method: "GET", signal });
  return expectShape(campaignViewSchema, body, "the campaign");
}

export async function getTimeline(id: string, signal: AbortSignal): Promise<TimelineEventView[]> {
  const body = await send(`${campaignPath(id)}/timeline`, { method: "GET", signal });
  return expectShape(timelineSchema, body, "the timeline");
}

export async function requestPlan(id: string): Promise<void> {
  await send(`${campaignPath(id)}/plan`, { method: "POST" });
}

export async function approveCampaign(id: string, request: ApproveCampaignRequest): Promise<void> {
  await send(`${campaignPath(id)}/approve`, { method: "POST", body: json(request) });
}

export async function editCopy(id: string, request: EditCopyRequest): Promise<void> {
  await send(`${campaignPath(id)}/copy`, { method: "PATCH", body: json(request) });
}
