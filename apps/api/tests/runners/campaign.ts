import type { CampaignView, CreateCampaignRequest } from "@datum/core";
import { expect } from "vitest";
import { approve, plannedCampaign } from "../flows";
import { call } from "../support";
import { enrollTestRunner, type EnrolledRunner } from "./enroll";

export async function approvedCampaign(
  overrides: Partial<CreateCampaignRequest> = {},
): Promise<CampaignView> {
  const planned = await plannedCampaign(overrides);
  const reply = await approve(planned.id, 1);
  expect(reply.status).toBe(200);
  return reply.body;
}

export const start = (campaignId: string) =>
  call<CampaignView>("POST", `/campaigns/${campaignId}/start`);

export interface StartedCampaign {
  readonly campaign: CampaignView;
  readonly runner: EnrolledRunner;
}

export async function startedCampaign(
  overrides: Partial<CreateCampaignRequest> = {},
): Promise<StartedCampaign> {
  const runner = await enrollTestRunner();
  const approved = await approvedCampaign(overrides);
  const reply = await start(approved.id);
  expect(reply.status).toBe(200);
  return { campaign: reply.body, runner };
}

export const taskFor = (campaign: CampaignView, spotCode: string | null) => {
  const task = campaign.tasks.find((candidate) => candidate.spotCode === spotCode);
  if (task === undefined) throw new Error(`No task for ${spotCode ?? "the print run"}`);
  return task;
};
