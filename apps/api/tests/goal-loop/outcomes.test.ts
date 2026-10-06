import { and, eq } from "drizzle-orm";
import type { CampaignView, EvidenceView } from "@datum/core";
import { spots } from "@datum/db";
import { describe, expect, it } from "vitest";
import { startedCampaign, taskFor } from "../runners/campaign";
import { jpegFile, phonePhoto, postForm, runnerCall, taskPath } from "../runners/calls";
import { call, db, resetDatabaseBetweenTests } from "../support";
import { runPass } from "./loop";

resetDatabaseBetweenTests();

const spotsOf = async (campaignId: string) =>
  (await call<CampaignView>("GET", `/campaigns/${campaignId}`)).body.spots.map((spot) => [
    spot.code,
    spot.status,
    spot.firstPassStatus,
  ]);

describe("spot outcomes come from evidence and task closure", () => {
  it("marks a placement closed without a valid photo as a first-pass miss", async () => {
    const { campaign, runner } = await startedCampaign();
    const taskId = taskFor(campaign, "A").id;
    await runnerCall("POST", taskPath(runner.token, taskId, "accept"));
    const wrongCard = await phonePhoto(campaign, "B");
    const upload = await postForm<EvidenceView>(taskPath(runner.token, taskId, "evidence"), {
      photo: jpegFile(wrongCard),
    });
    expect(upload.body).toMatchObject({ verdict: "FAIL", failure: "QR_WRONG_SPOT" });
    expect(await spotsOf(campaign.id)).toEqual([
      ["A", "PENDING", "PENDING"],
      ["B", "PENDING", "PENDING"],
    ]);
    await runnerCall("POST", taskPath(runner.token, taskId, "complete"));
    expect(await spotsOf(campaign.id)).toEqual([
      ["A", "MISS", "MISS"],
      ["B", "PENDING", "PENDING"],
    ]);
  });

  it("re-derives a spot from the database on every pass instead of trusting a stored status", async () => {
    const { campaign } = await startedCampaign();
    await db
      .update(spots)
      .set({ status: "PASS" })
      .where(and(eq(spots.campaignId, campaign.id), eq(spots.code, "B")));
    await runPass();
    expect(await spotsOf(campaign.id)).toEqual([
      ["A", "PENDING", "PENDING"],
      ["B", "PENDING", "PENDING"],
    ]);
  });
});
