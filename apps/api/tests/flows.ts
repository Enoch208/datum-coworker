import {
  acceptExpenseStatementFor,
  approveStatementFor,
  raiseBudgetStatementFor,
  type CampaignView,
  type CreateCampaignRequest,
  type PublicCopy,
} from "@datum/core";
import { expect } from "vitest";
import { ownerSign, testOwner, type TestOwner } from "./owner-key";
import { app, appBaseUrl, call, createCampaign } from "./support";

export async function plannedCampaign(
  overrides: Partial<CreateCampaignRequest> = {},
): Promise<CampaignView> {
  const campaign = await createCampaign(overrides);
  const reply = await call<CampaignView>("POST", `/campaigns/${campaign.id}/plan`);
  expect(reply.status).toBe(200);
  return reply.body;
}

export async function signedApproval(
  campaignId: string,
  assetVersion: number,
  approvedBy = "Mei Tan",
  owner: TestOwner = testOwner,
) {
  const view = (await call<CampaignView>("GET", `/campaigns/${campaignId}`)).body;
  return {
    assetVersion,
    approvedBy,
    ownerKey: owner.key,
    signature:
      view.proposal === null
        ? "A".repeat(86)
        : ownerSign(approveStatementFor(view, approvedBy), owner),
  };
}

export async function approve(campaignId: string, assetVersion: number, approvedBy = "Mei Tan") {
  return call<CampaignView>(
    "POST",
    `/campaigns/${campaignId}/approve`,
    await signedApproval(campaignId, assetVersion, approvedBy),
  );
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

const viewOf = async (campaignId: string): Promise<CampaignView> =>
  (await call<CampaignView>("GET", `/campaigns/${campaignId}`)).body;

export async function signedRaise(
  campaignId: string,
  amount: string,
  approvedBy = "Mei Tan",
  owner: TestOwner = testOwner,
) {
  const budget = { amount, currency: "SGD" as const };
  const statement = raiseBudgetStatementFor(await viewOf(campaignId), budget, approvedBy);
  return { budget, approvedBy, signature: ownerSign(statement, owner) };
}

export async function signedAccept(
  campaignId: string,
  expenseId: string,
  acceptedBy: string,
  reason: string,
  owner: TestOwner = testOwner,
) {
  const view = await viewOf(campaignId);
  const statement = acceptExpenseStatementFor(view, expenseId, acceptedBy, reason);
  return { acceptedBy, reason, signature: ownerSign(statement, owner) };
}
