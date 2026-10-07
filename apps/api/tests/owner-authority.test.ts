import { createPublicKey, verify } from "node:crypto";
import {
  acceptExpenseStatementFor,
  approveStatementFor,
  ownerStatementText,
  raiseBudgetStatementFor,
  type ApiError,
  type CampaignView,
} from "@datum/core";
import { approvals, interventions } from "@datum/db";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { plannedCampaign, signedAccept, signedApproval, signedRaise } from "./flows";
import { fieldCampaign, markDoneWithoutValidPhoto, placeAndProve } from "./goal-loop/field";
import { runPass } from "./goal-loop/loop";
import { newTestOwner, ownerSign, testOwner } from "./owner-key";
import { startedCampaign } from "./runners/campaign";
import { campaignNow, purchaseReading, sendPrintReceipt } from "./runners/print";
import { call, db, resetDatabaseBetweenTests } from "./support";

resetDatabaseBetweenTests();

const approveAs = (campaignId: string, body: object) =>
  call<CampaignView & ApiError>("POST", `/campaigns/${campaignId}/approve`, body);

const verifies = (key: string, statement: string, signature: string): boolean =>
  verify(
    "sha256",
    Buffer.from(statement, "utf8"),
    {
      key: createPublicKey({ key: Buffer.from(key, "base64url"), format: "der", type: "spki" }),
      dsaEncoding: "ieee-p1363",
    },
    Buffer.from(signature, "base64url"),
  );

async function waitingForBudget(): Promise<string> {
  const field = await fieldCampaign(["A", "B", "C", "D"], "50.00");
  await placeAndProve(field, "A");
  await placeAndProve(field, "B");
  await markDoneWithoutValidPhoto(field, "C");
  await placeAndProve(field, "D");
  await runPass();
  expect((await campaignNow(field.campaign.id)).status).toBe("NEEDS_APPROVAL");
  return field.campaign.id;
}

describe("only the campaign's owner can approve, raise the budget or accept a receipt", () => {
  it("binds the owner's key at creation and keeps a statement anyone can re-verify", async () => {
    const planned = await plannedCampaign({ ownerKey: testOwner.key });
    expect(planned.ownerKeyRegistered).toBe(true);
    const approved = await approveAs(planned.id, await signedApproval(planned.id, 1));
    expect(approved).toMatchObject({ status: 200, body: { status: "APPROVED" } });
    const [row] = await db.select().from(approvals).where(eq(approvals.campaignId, planned.id));
    expect(row?.ownerStatement).toBe(ownerStatementText(approveStatementFor(planned, "Mei Tan")));
    expect(verifies(testOwner.key, row?.ownerStatement ?? "", row?.ownerSignature ?? "")).toBe(
      true,
    );
  });

  it("refuses an approval signed by anyone but the registered owner", async () => {
    const planned = await plannedCampaign({ ownerKey: testOwner.key });
    const stranger = newTestOwner();
    const withStrangerKey = await signedApproval(planned.id, 1, "Mei Tan", stranger);
    expect(await approveAs(planned.id, withStrangerKey)).toMatchObject({
      status: 403,
      body: { error: "OWNER_KEY_MISMATCH" },
    });
    const withoutKey = {
      assetVersion: withStrangerKey.assetVersion,
      approvedBy: withStrangerKey.approvedBy,
      signature: withStrangerKey.signature,
    };
    expect(await approveAs(planned.id, withoutKey)).toMatchObject({
      status: 403,
      body: { error: "OWNER_SIGNATURE_INVALID" },
    });
    expect((await campaignNow(planned.id)).status).toBe("AWAITING_APPROVAL");
    expect(await db.select().from(approvals)).toEqual([]);
  });

  it("refuses a signature over different terms than the ones being approved", async () => {
    const planned = await plannedCampaign({ ownerKey: testOwner.key });
    const cheaper = { ...approveStatementFor(planned, "Mei Tan") };
    const signedForMore = ownerSign({
      ...cheaper,
      budget: { amount: "500.00", currency: "SGD" },
    });
    const body = { assetVersion: 1, approvedBy: "Mei Tan", signature: signedForMore };
    expect(await approveAs(planned.id, body)).toMatchObject({
      status: 403,
      body: { error: "OWNER_SIGNATURE_INVALID" },
    });
  });

  it("refuses an approval with no owner key when the campaign has none yet", async () => {
    const planned = await plannedCampaign();
    expect(planned.ownerKeyRegistered).toBe(false);
    const signed = await signedApproval(planned.id, 1);
    const unregistered = {
      assetVersion: signed.assetVersion,
      approvedBy: signed.approvedBy,
      signature: signed.signature,
    };
    expect(await approveAs(planned.id, unregistered)).toMatchObject({
      status: 403,
      body: { error: "OWNER_KEY_REQUIRED" },
    });
  });

  it("binds the first approving key on a campaign created without one, then holds it", async () => {
    const planned = await plannedCampaign();
    expect(await approveAs(planned.id, await signedApproval(planned.id, 1))).toMatchObject({
      status: 200,
    });
    expect((await campaignNow(planned.id)).ownerKeyRegistered).toBe(true);
  });

  it("refuses a budget raise signed for a smaller amount or by someone else", async () => {
    const id = await waitingForBudget();
    const view = await campaignNow(id);
    const signedFor60 = ownerSign(
      raiseBudgetStatementFor(view, { amount: "60.00", currency: "SGD" }, "Mei Tan"),
    );
    const askedFor90 = {
      budget: { amount: "90.00", currency: "SGD" },
      approvedBy: "Mei Tan",
      signature: signedFor60,
    };
    expect(await call<ApiError>("POST", `/campaigns/${id}/budget`, askedFor90)).toMatchObject({
      status: 403,
      body: { error: "OWNER_SIGNATURE_INVALID" },
    });
    const byStranger = await signedRaise(id, "60.00", "Mei Tan", newTestOwner());
    expect(await call<ApiError>("POST", `/campaigns/${id}/budget`, byStranger)).toMatchObject({
      status: 403,
      body: { error: "OWNER_SIGNATURE_INVALID" },
    });
    expect((await campaignNow(id)).status).toBe("NEEDS_APPROVAL");
    expect(await db.select().from(interventions)).toEqual([]);
  });

  it("refuses a receipt acceptance whose signed reason or signer differs", async () => {
    const started = await startedCampaign();
    const id = started.campaign.id;
    const doubtful = { ...purchaseReading("6.00"), isPurchaseReceipt: false, concerns: ["test"] };
    const sent = await sendPrintReceipt(started, "6.00", doubtful);
    expect(sent.body.status).toBe("DISPUTED");
    const view = await campaignNow(id);
    const signedReason = ownerSign(
      acceptExpenseStatementFor(view, sent.body.id, "Mei Tan", "I paid in cash."),
    );
    const otherReason = { acceptedBy: "Mei Tan", reason: "Anything", signature: signedReason };
    const path = `/campaigns/${id}/expenses/${sent.body.id}/accept`;
    expect(await call<ApiError>("POST", path, otherReason)).toMatchObject({
      status: 403,
      body: { error: "OWNER_SIGNATURE_INVALID" },
    });
    const byStranger = await signedAccept(id, sent.body.id, "Mei", "Paid", newTestOwner());
    expect(await call<ApiError>("POST", path, byStranger)).toMatchObject({ status: 403 });
    expect(await db.select().from(interventions)).toEqual([]);
  });

  it("rejects a malformed owner key at creation", async () => {
    const reply = await call<ApiError>("POST", "/campaigns", {
      brandName: "Kopi Lab",
      brandUrl: null,
      message: "Free oat flat white",
      destinationUrl: "https://kopilab.example/offer",
      spots: [{ code: "A", name: "Amoy Street cafe window", instructions: "Tape inside" }],
      deadline: new Date(Date.now() + 3 * 3_600_000).toISOString(),
      budget: { amount: "50.00", currency: "SGD" },
      ownerKey: "A".repeat(122),
    });
    expect(reply).toMatchObject({ status: 403, body: { error: "OWNER_KEY_INVALID" } });
  });
});
