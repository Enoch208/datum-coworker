import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { CampaignReceipt, TimelineEventView } from "@datum/core";
import { campaignReceipts, spots } from "@datum/db";
import { describe, expect, it } from "vitest";
import { call, db, resetDatabaseBetweenTests } from "../support";
import {
  fieldCampaign,
  markDoneWithoutValidPhoto,
  placeAndProve,
  refreshed,
  type FieldCampaign,
} from "./field";
import { loopDeps, runPass } from "./loop";

resetDatabaseBetweenTests();

async function missedC(): Promise<FieldCampaign> {
  const field = await fieldCampaign(["A", "B", "C", "D"], "60.00");
  await placeAndProve(field, "A");
  await placeAndProve(field, "B");
  await markDoneWithoutValidPhoto(field, "C");
  await placeAndProve(field, "D");
  return field;
}

async function stored(campaignId: string) {
  const rows = await db
    .select()
    .from(campaignReceipts)
    .where(eq(campaignReceipts.campaignId, campaignId));
  expect(rows).toHaveLength(1);
  const [row] = rows;
  if (row === undefined) throw new Error("no receipt");
  const parsed: unknown = JSON.parse(row.canonicalJson);
  return { row, receipt: parsed as CampaignReceipt };
}

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

describe("the Campaign Receipt is persisted with its exact bytes", () => {
  it("publishes 4 of 4 with a first pass of 3, one recovery and zero interventions", async () => {
    const field = await missedC();
    await runPass();
    const proof = await placeAndProve(await refreshed(field), "C", 5);
    await runPass();
    const id = field.campaign.id;
    const { row, receipt } = await stored(id);
    expect(row.sha256).toBe(sha256(row.canonicalJson));
    expect(row.status).toBe("COMPLETED");
    expect(receipt).toMatchObject({
      campaignId: id,
      campaignName: "Kopi Lab",
      status: "COMPLETED",
      target: { spots: 4, budget: { amountMinor: 6_000, currency: "SGD" } },
      actual: {
        spotsPassed: 4,
        completedAt: proof.submittedAt,
        spend: { amountMinor: 5_600, currency: "SGD" },
      },
      firstPassPassed: 3,
      recoveryActions: 1,
      recoveries: [
        {
          round: 1,
          source: "FALLBACK",
          idempotencyKey: `campaign:${id}:spot:C:attempt:2`,
          spotCodes: ["C"],
        },
      ],
      postApprovalInterventions: 0,
      interventions: [],
      executorAdapters: ["LOCAL_ENROLLED_RUNNER"],
      masumi: null,
    });
    expect(
      receipt.spots.map((spot) => [spot.spotCode, spot.firstPass, spot.final, spot.attempts]),
    ).toEqual([
      ["A", "PASS", "PASS", 1],
      ["B", "PASS", "PASS", 1],
      ["C", "MISS", "PASS", 2],
      ["D", "PASS", "PASS", 1],
    ]);
    expect(receipt.spendLines.map((line) => [line.kind, line.amount.amountMinor])).toEqual([
      ["RECEIPT", 600],
      ["AGREED_FEE", 1_000],
      ["AGREED_FEE", 1_000],
      ["AGREED_FEE", 1_000],
      ["AGREED_FEE", 1_000],
      ["AGREED_FEE", 1_000],
    ]);
    const timeline = (await call<TimelineEventView[]>("GET", `/campaigns/${id}/timeline`)).body;
    expect(timeline.at(-1)).toMatchObject({
      type: "RECEIPT_PUBLISHED",
      actor: "DATUM_RULES",
      summary: `Published the Campaign Receipt: 4 of 4 spots live, 3 on the first pass, 1 recovery, 0 post-approval interventions, SGD 56.00 spent (sha256 ${row.sha256.slice(0, 12)})`,
    });
    await runPass();
    await stored(id);
  });

  it("publishes an honest receipt for a campaign that expired with a spot missing", async () => {
    const field = await missedC();
    const late = new Date(new Date(field.campaign.deadline).getTime() + 60_000);
    await runPass(loopDeps({ now: () => late }));
    const { row, receipt } = await stored(field.campaign.id);
    expect(row.status).toBe("EXPIRED_INCOMPLETE");
    expect(receipt).toMatchObject({
      status: "EXPIRED_INCOMPLETE",
      actual: { spotsPassed: 3, completedAt: null },
      firstPassPassed: 3,
      recoveryActions: 0,
    });
    expect(receipt.spots.find((spot) => spot.spotCode === "C")).toMatchObject({
      final: "MISS",
      passedAt: null,
    });
  });

  it("copies the induced-miss label onto the receipt for display only", async () => {
    const field = await missedC();
    await db.update(spots).set({ inducedMiss: true }).where(eq(spots.code, "C"));
    await runPass();
    await placeAndProve(await refreshed(field), "C", 5);
    await runPass();
    const { receipt } = await stored(field.campaign.id);
    expect(receipt.spots.find((spot) => spot.spotCode === "C")?.inducedMiss).toBe(true);
    expect(receipt.status).toBe("COMPLETED");
  });
});
