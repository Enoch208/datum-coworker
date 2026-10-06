import type { CampaignView, CreateCampaignRequest, PublicCopy } from "@datum/core";
import { expect } from "vitest";
import { app, appBaseUrl, call, createCampaign } from "./support";

export async function plannedCampaign(
  overrides: Partial<CreateCampaignRequest> = {},
): Promise<CampaignView> {
  const campaign = await createCampaign(overrides);
  const reply = await call<CampaignView>("POST", `/campaigns/${campaign.id}/plan`);
  expect(reply.status).toBe(200);
  return reply.body;
}

export async function approve(campaignId: string, assetVersion: number, approvedBy = "Mei Tan") {
  return call<CampaignView>("POST", `/campaigns/${campaignId}/approve`, {
    assetVersion,
    approvedBy,
  });
}

export async function editCopy(campaignId: string, copy: PublicCopy) {
  return call<CampaignView>("PATCH", `/campaigns/${campaignId}/copy`, { copy });
}

export async function fetchAsset(url: string): Promise<Response> {
  expect(url.startsWith(`${appBaseUrl}/assets/`)).toBe(true);
  return app.request(url.slice(appBaseUrl.length));
}

export async function assetBytes(url: string): Promise<Uint8Array> {
  const response = await fetchAsset(url);
  expect(response.status).toBe(200);
  return new Uint8Array(await response.arrayBuffer());
}
