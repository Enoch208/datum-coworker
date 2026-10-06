import { eq } from "drizzle-orm";
import type { CampaignView, EvidenceView, TimelineEventView } from "@datum/core";
import { auditEvents, evidence, physicalTasks } from "@datum/db";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { approvedCampaign, startedCampaign, taskFor } from "./runners/campaign";
import { jpegFile, phonePhoto, postForm, runnerCall, taskPath } from "./runners/calls";
import { app, call, db, resetDatabaseBetweenTests } from "./support";

resetDatabaseBetweenTests();

const allChecks = {
  photoReceived: true,
  qrDetected: true,
  campaignMatches: true,
  spotMatches: true,
  taskOpen: true,
  beforeDeadline: true,
};

async function placementReady(spotCode = "A") {
  const started = await startedCampaign();
  const taskId = taskFor(started.campaign, spotCode).id;
  await runnerCall("POST", taskPath(started.runner.token, taskId, "accept"));
  return { ...started, taskId };
}

const upload = (token: string, taskId: string, bytes: Uint8Array) =>
  postForm<EvidenceView>(taskPath(token, taskId, "evidence"), { photo: jpegFile(bytes) });

const campaignNow = async (id: string) =>
  (await call<CampaignView>("GET", `/campaigns/${id}`)).body;

const spotOf = (campaign: CampaignView, code: string) =>
  campaign.spots.find((spot) => spot.code === code);

describe("POST /runner/:token/tasks/:taskId/evidence (Gate 4)", () => {
  it("passes a phone photo of the right spot's card and marks the spot", async () => {
    const { campaign, runner, taskId } = await placementReady();
    const reply = await upload(runner.token, taskId, await phonePhoto(campaign, "A"));
    expect(reply.status).toBe(201);
    expect(reply.body).toMatchObject({
      taskId,
      spotCode: "A",
      verdict: "PASS",
      failure: null,
      checks: allChecks,
      explanation: "This photo shows Spot A's code for this campaign and arrived in time.",
    });
    expect(reply.body.photoUrl).toMatch(/^https:\/\/datum\.test\/evidence\/[0-9a-f]{32}\.jpg$/);
    const now = await campaignNow(campaign.id);
    expect(spotOf(now, "A")).toMatchObject({
      status: "PASS",
      firstPassStatus: "PASS",
      latestEvidence: { id: reply.body.id, verdict: "PASS" },
    });
    expect(now.tasks.find((task) => task.id === taskId)?.status).toBe("SUBMITTED");
    expect(now.status).toBe("EXECUTING");
  });

  it("fails Spot B's card photographed for Spot A as QR_WRONG_SPOT", async () => {
    const { campaign, runner, taskId } = await placementReady();
    const reply = await upload(runner.token, taskId, await phonePhoto(campaign, "B"));
    expect(reply.body).toMatchObject({
      verdict: "FAIL",
      failure: "QR_WRONG_SPOT",
      explanation: "This photo shows Spot B's code, not Spot A's.",
      checks: { ...allChecks, spotMatches: false },
    });
    expect(spotOf(await campaignNow(campaign.id), "A")?.status).toBe("PENDING");
  });

  it("fails another campaign's card as QR_WRONG_CAMPAIGN", async () => {
    const { runner, taskId } = await placementReady();
    const other = await approvedCampaign();
    const reply = await upload(runner.token, taskId, await phonePhoto(other, "A"));
    expect(reply.body).toMatchObject({
      verdict: "FAIL",
      failure: "QR_WRONG_CAMPAIGN",
      checks: { ...allChecks, campaignMatches: false, spotMatches: false },
    });
  });

  it("fails a photo with no readable code as QR_NOT_FOUND", async () => {
    const { runner, taskId } = await placementReady();
    const blank = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: "#8a8f7a" },
    })
      .jpeg()
      .toBuffer();
    const reply = await upload(runner.token, taskId, blank);
    expect(reply.body).toMatchObject({
      verdict: "FAIL",
      failure: "QR_NOT_FOUND",
      checks: { ...allChecks, qrDetected: false, campaignMatches: false, spotMatches: false },
    });
  });

  it("keeps a late photo of the right card but fails it as LATE_EVIDENCE", async () => {
    const { campaign, runner, taskId } = await placementReady();
    await db
      .update(physicalTasks)
      .set({ dueBy: new Date(Date.now() - 60_000) })
      .where(eq(physicalTasks.id, taskId));
    const reply = await upload(runner.token, taskId, await phonePhoto(campaign, "A"));
    expect(reply.body).toMatchObject({
      verdict: "FAIL",
      failure: "LATE_EVIDENCE",
      checks: { ...allChecks, beforeDeadline: false },
    });
    expect(spotOf(await campaignNow(campaign.id), "A")?.status).toBe("PENDING");
    expect(await db.select().from(evidence)).toHaveLength(1);
  });

  it("counts the same photo uploaded twice once", async () => {
    const { campaign, runner, taskId } = await placementReady();
    const photo = await phonePhoto(campaign, "A");
    const first = await upload(runner.token, taskId, photo);
    const second = await upload(runner.token, taskId, photo);
    expect(first.status).toBe(201);
    expect(second).toMatchObject({ status: 200, body: first.body });
    expect(await db.select().from(evidence)).toHaveLength(1);
    const received = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.type, "EVIDENCE_RECEIVED"));
    expect(received).toHaveLength(1);
  });

  it("says in the timeline who sent the photo and what the rules decided", async () => {
    const { campaign, runner, taskId } = await placementReady();
    await upload(runner.token, taskId, await phonePhoto(campaign, "B"));
    const events = await call<TimelineEventView[]>("GET", `/campaigns/${campaign.id}/timeline`);
    expect(events.body.slice(-2).map(({ actor, summary }) => [actor, summary])).toEqual([
      ["RUNNER", "Ana uploaded a photo for Spot A"],
      ["DATUM_RULES", "Spot A FAIL (QR_WRONG_SPOT): This photo shows Spot B's code, not Spot A's."],
    ]);
  });

  it("finishes a placement after its photo without completing the campaign", async () => {
    const { campaign, runner, taskId } = await placementReady();
    await upload(runner.token, taskId, await phonePhoto(campaign, "A"));
    const done = await runnerCall("POST", taskPath(runner.token, taskId, "complete"));
    expect(done).toMatchObject({ status: 200, body: { status: "COMPLETED" } });
    expect((await campaignNow(campaign.id)).status).toBe("EXECUTING");
    const late = await upload(runner.token, taskId, await phonePhoto(campaign, "A", { seed: 9 }));
    expect(late).toMatchObject({ status: 409, body: { error: "TASK_COMPLETED" } });
  });

  it("records a first-pass miss when a placement finishes without a passing photo", async () => {
    const { campaign, runner, taskId } = await placementReady();
    await upload(runner.token, taskId, await phonePhoto(campaign, "B"));
    await runnerCall("POST", taskPath(runner.token, taskId, "complete"));
    expect(spotOf(await campaignNow(campaign.id), "A")).toMatchObject({
      status: "MISS",
      firstPassStatus: "MISS",
      latestEvidence: { failure: "QR_WRONG_SPOT" },
    });
  });

  it("refuses a photo for a print run and for a task not yet accepted", async () => {
    const { campaign, runner } = await startedCampaign();
    const photo = await phonePhoto(campaign, "A");
    const print = taskFor(campaign, null).id;
    await runnerCall("POST", taskPath(runner.token, print, "accept"));
    expect(await upload(runner.token, print, photo)).toMatchObject({
      status: 409,
      body: { error: "NOT_A_PLACEMENT" },
    });
    expect(await upload(runner.token, taskFor(campaign, "B").id, photo)).toMatchObject({
      status: 409,
      body: { error: "TASK_NOT_ACCEPTED" },
    });
  });
});

describe("GET /evidence/:file", () => {
  it("serves only well-formed stored names", async () => {
    for (const name of ["..%2Fsecret.jpg", "abc.jpg", `${"a".repeat(32)}.png`]) {
      expect((await app.request(`/evidence/${name}`)).status).toBe(404);
    }
    expect((await app.request(`/evidence/${"a".repeat(32)}.jpg`)).status).toBe(404);
  });
});
