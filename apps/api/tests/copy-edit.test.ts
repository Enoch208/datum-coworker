import type { ApiError } from "@datum/core";
import { eq } from "drizzle-orm";
import { auditEvents, campaignAssets, campaigns } from "@datum/db";
import { describe, expect, it } from "vitest";
import { decodeQr } from "./cards/decode";
import { approve, assetBytes, editCopy, plannedCampaign } from "./flows";
import { call, createCampaign, db, resetDatabaseBetweenTests } from "./support";

resetDatabaseBetweenTests();

const newCopy = { headline: "Oat flat whites are on us", subcopy: "Show this card at Kopi Lab." };

describe("PATCH /campaigns/:id/copy (Gate 2)", () => {
  it("makes an approved campaign need a new approval after a copy edit", async () => {
    const planned = await plannedCampaign();
    const approved = await approve(planned.id, 1);
    const edited = await editCopy(planned.id, newCopy);
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({
      status: "AWAITING_APPROVAL",
      approvedAt: null,
      proposal: { assetVersion: 2, copy: newCopy },
      approval: { version: 1, assetVersion: 1, copy: planned.proposal?.copy, current: false },
    });
    expect(edited.body.proposal?.assetHash).not.toBe(approved.body.proposal?.assetHash);
    expect(await approve(planned.id, 1)).toMatchObject({
      status: 409,
      body: { error: "STALE_PROPOSAL" },
    });
    const reapproved = await approve(planned.id, 2);
    expect(reapproved.body).toMatchObject({
      status: "APPROVED",
      approval: { version: 2, assetVersion: 2, copy: newCopy, current: true },
    });
  });

  it("re-renders every card for the new version and each still scans to its spot", async () => {
    const planned = await plannedCampaign();
    const edited = await editCopy(planned.id, newCopy);
    for (const spot of edited.body.spots) {
      expect(spot.card?.pngUrl).toContain(`/v2/${spot.code}.png`);
      expect(await decodeQr(await assetBytes(spot.card?.pngUrl ?? ""))).toBe(spot.qrTargetUrl);
    }
  });

  it("records the edit and the move back to awaiting approval", async () => {
    const planned = await plannedCampaign();
    await approve(planned.id, 1);
    await editCopy(planned.id, newCopy);
    const events = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.campaignId, planned.id));
    const tail = events.slice(-3).map((event) => [event.type, event.payload]);
    expect(tail).toEqual([
      ["COPY_EDITED", { fromVersion: 1, assetVersion: 2, supersededApproval: 1 }],
      ["STATUS_CHANGED", { from: "APPROVED", to: "AWAITING_APPROVAL" }],
      ["CARDS_RENDERED", expect.objectContaining({ assetVersion: 2 }) as unknown],
    ]);
  });

  it("keeps an unapproved campaign awaiting approval with a new version", async () => {
    const planned = await plannedCampaign();
    const edited = await editCopy(planned.id, newCopy);
    expect(edited.body).toMatchObject({ status: "AWAITING_APPROVAL", approval: null });
    expect(edited.body.proposal?.steps).toEqual(planned.proposal?.steps);
    expect(edited.body.proposal?.estimatedSpend).toEqual(planned.proposal?.estimatedSpend);
  });

  it("treats the same copy as no change", async () => {
    const planned = await plannedCampaign();
    const same = await editCopy(planned.id, {
      headline: `  ${planned.proposal?.copy.headline ?? ""} `,
      subcopy: planned.proposal?.copy.subcopy ?? "",
    });
    expect(same.body.proposal?.assetVersion).toBe(1);
    expect(await db.select().from(campaignAssets)).toHaveLength(1);
  });

  it.each([
    ["a forbidden claim", { headline: "Guaranteed great coffee", subcopy: "Show this card." }],
    ["a headline the card cannot fit", { headline: "x".repeat(49), subcopy: "Show this card." }],
    ["characters the card cannot print", { headline: "Free coffee ☕", subcopy: "Show this." }],
    ["an empty subcopy", { headline: "Free coffee", subcopy: "   " }],
  ])("refuses copy with %s", async (_label, copy) => {
    const planned = await plannedCampaign();
    const reply = await call<ApiError>("PATCH", `/campaigns/${planned.id}/copy`, { copy });
    expect(reply).toMatchObject({ status: 422, body: { error: "COPY_REJECTED" } });
    expect(await db.select().from(campaignAssets)).toHaveLength(1);
  });

  it("refuses an edit once execution has started", async () => {
    const planned = await plannedCampaign();
    await approve(planned.id, 1);
    await db.update(campaigns).set({ status: "EXECUTING" }).where(eq(campaigns.id, planned.id));
    expect(await editCopy(planned.id, newCopy)).toMatchObject({
      status: 409,
      body: { error: "COPY_LOCKED" },
    });
  });

  it("refuses an edit before there is a proposal", async () => {
    const draft = await createCampaign();
    expect(await editCopy(draft.id, newCopy)).toMatchObject({
      status: 409,
      body: { error: "NO_PROPOSAL" },
    });
  });
});
