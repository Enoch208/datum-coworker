import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { CampaignReceiptView } from "@datum/core";
import { masumiPaymentEvidence } from "@datum/db";
import { describe, expect, it } from "vitest";
import { expireUnstartedCampaign } from "../src/goal-loop/unstarted";
import { afterDeadline, hireThroughTask, hiringTaskId, never } from "./coworker-hire";
import { plannedCampaign } from "./flows";
import { approvedCampaign } from "./runners/campaign";
import { app, call, db, resetDatabaseBetweenTests } from "./support";

resetDatabaseBetweenTests();

describe("the receipt shows the payment for the Task that hired Datum", () => {
  const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

  it("fills the payment block from the Task's evidence and serves the exact hashed bytes", async () => {
    const approved = await approvedCampaign();
    await hireThroughTask(approved.id);
    await expireUnstartedCampaign(afterDeadline(approved.deadline), approved.id, never);
    const evidence = {
      campaignId: approved.id,
      sokosumiTaskId: hiringTaskId,
      paymentId: "cmuwpay0000000000000000001",
      blockchainIdentifier: "00e04c0860a60c61066056281180462d0b120001",
      resultHash: "58676243".padEnd(64, "a"),
      sellerAddress: "addr_test1qpgqh5zs3x96srsu6697d2vee6ge7pe9yxz0p2rlzeagry",
      tokenUnit: "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d",
    };
    await db.insert(masumiPaymentEvidence).values(evidence);
    const pending = await call<CampaignReceiptView>("GET", `/campaigns/${approved.id}/receipt`);
    expect(pending.body.masumi).toEqual({
      ...Object.fromEntries(Object.entries(evidence).filter(([key]) => key !== "campaignId")),
      collectionTxHash: null,
      netReceivedAtomic: null,
      collectionConfirmed: false,
      verifiedAt: null,
    });

    const verifiedAt = new Date("2026-10-07T12:00:00.000Z");
    const collectionTxHash = "0ae460f6d36d76c600dd84287a9d3834754c6d9ea1e56ce3939a00c080b587f9";
    await db
      .update(masumiPaymentEvidence)
      .set({
        collectionTxHash,
        netReceivedAtomic: "1000000",
        collectionConfirmed: true,
        verifiedAt,
      })
      .where(eq(masumiPaymentEvidence.sokosumiTaskId, hiringTaskId));
    const paid = await call<CampaignReceiptView>("GET", `/campaigns/${approved.id}/receipt`);
    expect(paid.body.masumi).toMatchObject({
      collectionTxHash,
      netReceivedAtomic: "1000000",
      collectionConfirmed: true,
      verifiedAt: verifiedAt.toISOString(),
    });

    const canonical = await app.request(`/campaigns/${approved.id}/receipt/canonical`);
    const bytes = await canonical.text();
    expect(canonical.status).toBe(200);
    expect(canonical.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(sha256(bytes)).toBe(paid.body.sha256);
    expect(canonical.headers.get("x-content-sha256")).toBe(paid.body.sha256);
    expect(JSON.parse(bytes)).toMatchObject({ campaignId: approved.id, masumi: null });
  });

  it("answers 404 for the exact bytes before the campaign ends", async () => {
    const planned = await plannedCampaign();
    const reply = await call<{ error: string }>(
      "GET",
      `/campaigns/${planned.id}/receipt/canonical`,
    );
    expect(reply.status).toBe(404);
    expect(reply.body.error).toBe("NO_RECEIPT");
  });
});
