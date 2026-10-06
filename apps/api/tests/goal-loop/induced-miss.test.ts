import { eq } from "drizzle-orm";
import type { CampaignReceiptView, CampaignView, TimelineEventView } from "@datum/core";
import { remediationDecisions } from "@datum/db";
import { describe, expect, it } from "vitest";
import { asOperator } from "../runners/enroll";
import { call, db, emptyDatabase, resetDatabaseBetweenTests } from "../support";
import { fieldCampaign, markDoneWithoutValidPhoto, placeAndProve, refreshed } from "./field";
import { runPass } from "./loop";

resetDatabaseBetweenTests();

const label = (campaignId: string, code: string, inducedMiss: boolean) =>
  asOperator<CampaignView>("POST", `/operator/campaigns/${campaignId}/spots/${code}/induced-miss`, {
    inducedMiss,
  });

const scrub = (value: unknown, campaignId: string): unknown =>
  JSON.parse(
    JSON.stringify(value)
      .replaceAll(campaignId, "<campaign>")
      .replace(/"(tsk|evd|exp|evt|rmd|rct|itv)_[0-9a-z]{16}"/g, '"<id>"')
      .replace(/\d{4}-\d{2}-\d{2}T[0-9:.]+Z/g, "<time>")
      .replace(/[0-9a-f]{32}\.jpg/g, "<photo>")
      .replace(/"[0-9a-f]{64}"/g, '"<hash>"')
      .replace(/(asset|sha256) [0-9a-f]{12}/g, "$1 <hash>")
      .replace(/\d+ minutes/g, "N minutes")
      .replace(/"minutesToDeadline":\d+/g, '"minutesToDeadline":0'),
  );

async function runScenario(inducedMiss: boolean) {
  const field = await fieldCampaign(["A", "B", "C", "D"], "60.00");
  const id = field.campaign.id;
  if (inducedMiss) expect((await label(id, "C", true)).status).toBe(200);
  await placeAndProve(field, "A");
  await placeAndProve(field, "B");
  await markDoneWithoutValidPhoto(field, "C");
  await placeAndProve(field, "D");
  await runPass();
  await placeAndProve(await refreshed(field), "C", 5);
  await runPass();
  const timeline = (await call<TimelineEventView[]>("GET", `/campaigns/${id}/timeline`)).body;
  const receipt = (await call<CampaignReceiptView>("GET", `/campaigns/${id}/receipt`)).body;
  const decisions = await db
    .select()
    .from(remediationDecisions)
    .where(eq(remediationDecisions.campaignId, id));
  return {
    status: (await call<CampaignView>("GET", `/campaigns/${id}`)).body.status,
    timeline: scrub(
      timeline.map(({ type, actor, summary }) => ({ type, actor, summary })),
      id,
    ),
    decisions: scrub(
      decisions.map(({ gaps, verdict, actions, fallbackUsed, round }) => ({
        gaps,
        verdict,
        actions,
        fallbackUsed,
        round,
      })),
      id,
    ),
    receipt: scrub(
      { ...receipt, spots: receipt.spots.map((spot) => ({ ...spot, inducedMiss: false })) },
      id,
    ),
    labelled: receipt.spots.find((spot) => spot.spotCode === "C")?.inducedMiss,
  };
}

describe("the induced-miss label is display-only", () => {
  it("changes no status, decision, timeline sentence or receipt number", async () => {
    const plain = await runScenario(false);
    await emptyDatabase();
    const labelled = await runScenario(true);
    expect(plain.labelled).toBe(false);
    expect(labelled.labelled).toBe(true);
    expect(labelled.status).toBe("COMPLETED");
    expect({ ...labelled, labelled: null }).toEqual({ ...plain, labelled: null });
  });

  it("is set only by an operator, on a real spot", async () => {
    const field = await fieldCampaign(["A"], "60.00");
    const id = field.campaign.id;
    expect(
      (
        await asOperator(
          "POST",
          `/operator/campaigns/${id}/spots/A/induced-miss`,
          { inducedMiss: true },
          null,
        )
      ).status,
    ).toBe(401);
    expect((await label(id, "Z", true)).status).toBe(404);
    const reply = await label(id, "A", true);
    expect(reply.body.spots[0]?.inducedMiss).toBe(true);
  });
});
