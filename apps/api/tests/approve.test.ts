import { assertExecutable, type ApiError, type CampaignView } from "@datum/core";
import { eq } from "drizzle-orm";
import { approvals, campaigns } from "@datum/db";
import { describe, expect, it } from "vitest";
import { currentAsset, latestApproval } from "../src/services/campaigns";
import { spotsHash } from "../src/services/hashes";
import { toApprovalLock } from "../src/views/proposal";
import { approve, editCopy, plannedCampaign } from "./flows";
import { call, createCampaign, db, resetDatabaseBetweenTests } from "./support";

resetDatabaseBetweenTests();

const executionCheck = async (campaignId: string) => {
  const approval = await latestApproval(db, campaignId);
  const asset = await currentAsset(db, campaignId);
  return () =>
    assertExecutable(approval === null ? null : toApprovalLock(approval), asset?.version ?? 0);
};

describe("POST /campaigns/:id/approve (Gate 2)", () => {
  it("locks the asset version, hashes, copy, spots, budget, deadline and evidence standard", async () => {
    const planned = await plannedCampaign();
    const reply = await approve(planned.id, 1);
    expect(reply.status).toBe(200);
    const campaign = reply.body;
    expect(campaign.status).toBe("APPROVED");
    expect(campaign.approvedAt).not.toBeNull();
    expect(campaign.approval).toEqual({
      version: 1,
      assetVersion: 1,
      assetHash: planned.proposal?.assetHash,
      spotsHash: spotsHash(planned.spots),
      copy: planned.proposal?.copy,
      budget: { amount: "50.00", currency: "SGD" },
      deadline: planned.deadline,
      evidencePolicy: "photo_with_decodable_spot_qr",
      approvedBy: "Mei Tan",
      approvedAt: campaign.approvedAt,
      current: true,
    });
    const [row] = await db.select().from(approvals);
    expect(row).toMatchObject({
      assetVersion: 1,
      approvedHeadline: "Your oat flat white is on us",
      budgetMinor: 5_000,
    });
  });

  it("refuses to approve a version that is not the current proposal", async () => {
    const planned = await plannedCampaign();
    const reply = await approve(planned.id, 2);
    expect(reply).toMatchObject({ status: 409, body: { error: "STALE_PROPOSAL" } });
    expect(await db.select().from(approvals)).toEqual([]);
  });

  it("refuses to approve before there is a proposal", async () => {
    const draft = await createCampaign();
    expect(await approve(draft.id, 1)).toMatchObject({
      status: 409,
      body: { error: "NO_PROPOSAL" },
    });
  });

  it("treats a repeated approval of the same version as one approval", async () => {
    const planned = await plannedCampaign();
    const first = await approve(planned.id, 1);
    const second = await approve(planned.id, 1);
    expect(second.body).toEqual(first.body);
    expect(await db.select().from(approvals)).toHaveLength(1);
  });

  it("refuses an approval once the deadline has passed", async () => {
    const planned = await plannedCampaign();
    await db
      .update(campaigns)
      .set({ deadline: new Date(Date.now() - 1_000) })
      .where(eq(campaigns.id, planned.id));
    expect(await approve(planned.id, 1)).toMatchObject({
      status: 409,
      body: { error: "DEADLINE_PASSED" },
    });
  });

  it.each([
    ["no approver", { assetVersion: 1 }],
    ["a blank approver", { assetVersion: 1, approvedBy: "  " }],
    ["a version that is not a positive whole number", { assetVersion: 0, approvedBy: "Mei" }],
    ["an extra field", { assetVersion: 1, approvedBy: "Mei", budget: "999.00" }],
  ])("rejects a request with %s", async (_label, body) => {
    const planned = await plannedCampaign();
    const reply = await call<ApiError>("POST", `/campaigns/${planned.id}/approve`, body);
    expect(reply).toMatchObject({ status: 400, body: { error: "VALIDATION_FAILED" } });
  });

  it("blocks execution without a current approval", async () => {
    const planned = await plannedCampaign();
    expect(await executionCheck(planned.id)).toThrow(
      expect.objectContaining({ code: "NO_APPROVAL" }),
    );
    await approve(planned.id, 1);
    expect((await executionCheck(planned.id))()).toMatchObject({ assetVersion: 1 });
    await editCopy(planned.id, { headline: "Oat flat whites on us", subcopy: "Show this card." });
    expect(await executionCheck(planned.id)).toThrow(
      expect.objectContaining({ code: "APPROVAL_NOT_CURRENT" }),
    );
  });
});

describe("the approved campaign view", () => {
  it("is what GET returns after approval", async () => {
    const planned = await plannedCampaign();
    const approved = await approve(planned.id, 1);
    const reply = await call<CampaignView>("GET", `/campaigns/${planned.id}`);
    expect(reply.body).toEqual(approved.body);
  });
});
