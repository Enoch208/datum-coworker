import { eq } from "drizzle-orm";
import type { ApiError, RunnerInboxView, RunnerTaskView } from "@datum/core";
import { auditEvents, physicalTasks, runners } from "@datum/db";
import { describe, expect, it } from "vitest";
import { start, startedCampaign, taskFor } from "./runners/campaign";
import { runnerCall, taskPath } from "./runners/calls";
import { enrollTestRunner } from "./runners/enroll";
import { call, db, resetDatabaseBetweenTests } from "./support";

resetDatabaseBetweenTests();

const inbox = (token: string) => runnerCall<RunnerInboxView>("GET", `/runner/${token}`);
const act = (token: string, taskId: string, action: string) =>
  runnerCall<RunnerTaskView>("POST", taskPath(token, taskId, action));

const refusedLink = { status: 404, body: { error: "NOT_FOUND" } };

describe("GET /runner/:token (Gate 3)", () => {
  it("shows the runner every dispatched task with its instructions and cards", async () => {
    const { campaign, runner } = await startedCampaign();
    const reply = await inbox(runner.token);
    expect(reply.status).toBe(200);
    expect(reply.body.runner).toEqual({ id: runner.view.runner.id, name: "Ana" });
    const [print, spotA, spotB] = reply.body.tasks;
    expect(print).toMatchObject({
      campaignId: campaign.id,
      brandName: "Kopi Lab",
      type: "PRINT_AND_COLLECT",
      status: "DISPATCHED",
      spot: null,
      estimatedCost: { amount: "6.00", currency: "SGD" },
      evidence: [],
      expense: null,
    });
    expect(print?.cards.map((card) => card.pdfUrl)).toEqual([
      `https://datum.test/assets/${campaign.id}/v1/A.pdf`,
      `https://datum.test/assets/${campaign.id}/v1/B.pdf`,
    ]);
    expect(spotA).toMatchObject({
      type: "PLACE_SPOT",
      spot: { code: "A", name: "Amoy Street cafe window", instructions: "Tape inside the glass" },
      cards: [{ pngUrl: `https://datum.test/assets/${campaign.id}/v1/A.png` }],
      dueBy: campaign.deadline,
    });
    expect(spotA?.instructions).toMatch(/^Place Spot A's card at Amoy Street cafe window\./);
    expect(spotB?.spot?.code).toBe("B");
  });

  it("answers an unknown, malformed, expired or deactivated link with a bare 404", async () => {
    const { runner } = await startedCampaign();
    expect(await inbox("A".repeat(43))).toMatchObject(refusedLink);
    expect(await inbox("short")).toMatchObject(refusedLink);
    await db.update(runners).set({ tokenExpiresAt: new Date(Date.now() - 1_000) });
    expect(await inbox(runner.token)).toMatchObject(refusedLink);
    await db.update(runners).set({ tokenExpiresAt: new Date(Date.now() + 60_000), active: false });
    const refused = await runnerCall<ApiError>("GET", `/runner/${runner.token}`);
    expect(refused).toMatchObject(refusedLink);
    expect(refused.body.message).not.toContain(runner.token);
  });

  it("never shows or opens another runner's tasks", async () => {
    const { campaign } = await startedCampaign();
    const other = await enrollTestRunner("Ben");
    expect((await inbox(other.token)).body.tasks).toEqual([]);
    const reply = await act(other.token, taskFor(campaign, "A").id, "accept");
    expect(reply).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
  });
});

describe("accepting and finishing a task (Gate 3)", () => {
  it("records when the runner accepted, once", async () => {
    const { campaign, runner } = await startedCampaign();
    const taskId = taskFor(campaign, "A").id;
    const first = await act(runner.token, taskId, "accept");
    expect(first).toMatchObject({ status: 200, body: { id: taskId, status: "ACCEPTED" } });
    const again = await act(runner.token, taskId, "accept");
    expect(again.body.status).toBe("ACCEPTED");
    const [row] = await db.select().from(physicalTasks).where(eq(physicalTasks.id, taskId));
    expect(row?.acceptedAt).toBeInstanceOf(Date);
    expect(row?.dispatchedAt?.getTime()).toBeLessThanOrEqual(row?.acceptedAt?.getTime() ?? 0);
    const accepted = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.type, "TASK_ACCEPTED"));
    expect(accepted).toHaveLength(1);
  });

  it("will not finish a task that was not accepted or has no proof yet", async () => {
    const { campaign, runner } = await startedCampaign();
    const spotA = taskFor(campaign, "A").id;
    const print = taskFor(campaign, null).id;
    expect(await act(runner.token, spotA, "complete")).toMatchObject({
      status: 409,
      body: { error: "TASK_NOT_ACCEPTED" },
    });
    await act(runner.token, spotA, "accept");
    expect(await act(runner.token, spotA, "complete")).toMatchObject({
      status: 409,
      body: { error: "EVIDENCE_REQUIRED" },
    });
    await act(runner.token, print, "accept");
    expect(await act(runner.token, print, "complete")).toMatchObject({
      status: 409,
      body: { error: "RECEIPT_REQUIRED" },
    });
  });

  it("refuses to act on a cancelled task", async () => {
    const { campaign, runner } = await startedCampaign();
    const taskId = taskFor(campaign, "B").id;
    await db.update(physicalTasks).set({ status: "CANCELLED" }).where(eq(physicalTasks.id, taskId));
    expect(await act(runner.token, taskId, "accept")).toMatchObject({
      status: 409,
      body: { error: "TASK_CLOSED" },
    });
    expect((await start(campaign.id)).body.status).toBe("EXECUTING");
    expect((await call("GET", `/campaigns/${campaign.id}`)).status).toBe(200);
  });
});
