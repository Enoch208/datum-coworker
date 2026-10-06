import { and, eq } from "drizzle-orm";
import type { CampaignView, TimelineEventView } from "@datum/core";
import { physicalTasks, runners } from "@datum/db";
import { describe, expect, it } from "vitest";
import { approvedCampaign, start, startedCampaign, taskFor } from "../runners/campaign";
import { asOperator, enrollTestRunner, inFuture, runnerLinkLifetimeMs } from "../runners/enroll";
import { campaignNow, finishPrint, sendPrintReceipt } from "../runners/print";
import { call, db, resetDatabaseBetweenTests } from "../support";
import { fieldCampaign, placeAndProve } from "./field";
import { loopDeps, runPass } from "./loop";

resetDatabaseBetweenTests();

const keysOf = async (campaignId: string) =>
  (await db.select().from(physicalTasks).where(eq(physicalTasks.campaignId, campaignId)))
    .map((task) => [task.idempotencyKey.replace(`campaign:${campaignId}:`, ""), task.status])
    .sort();

const timeline = async (campaignId: string) =>
  (await call<TimelineEventView[]>("GET", `/campaigns/${campaignId}/timeline`)).body;

const deactivate = (runnerId: string) =>
  asOperator("POST", `/operator/runners/${runnerId}/deactivate`);

const runnerOfTask = async (taskId: string) => {
  const [row] = await db
    .select({ name: runners.name })
    .from(physicalTasks)
    .innerJoin(runners, eq(runners.id, physicalTasks.runnerId))
    .where(eq(physicalTasks.id, taskId));
  return row?.name;
};

describe("runner validity", () => {
  it("never gives a task to a runner whose link ends before the task is due", async () => {
    const approved = await approvedCampaign();
    const reply = await asOperator("POST", "/operator/runners", {
      name: "Short link",
      expiresAt: new Date(new Date(approved.deadline).getTime() - 60_000).toISOString(),
    });
    expect(reply.status).toBe(201);
    expect(await start(approved.id)).toMatchObject({ status: 409, body: { error: "NO_RUNNER" } });
    await enrollTestRunner("Ben");
    const started = await start(approved.id);
    expect(started.status).toBe(200);
    expect(await runnerOfTask(taskFor(started.body, null).id)).toBe("Ben");
  });

  it("cancels a switched-off runner's print run and prints again through another runner", async () => {
    const started = await startedCampaign();
    const id = started.campaign.id;
    await deactivate(started.runner.view.runner.id);
    await enrollTestRunner("Ben");
    expect((await runPass()).failed).toEqual([]);
    expect(await keysOf(id)).toEqual([
      ["print:attempt:1", "CANCELLED"],
      ["print:attempt:2", "DISPATCHED"],
    ]);
    const reprint = (await campaignNow(id)).tasks.find((task) => task.attempt === 2);
    expect(await runnerOfTask(reprint?.id ?? "")).toBe("Ben");
    const story = (await timeline(id)).map((event) => [event.type, event.summary]);
    expect(story).toContainEqual([
      "RUNNER_UNAVAILABLE",
      "Ana's link is no longer active, so Datum cancelled the print run (attempt 1) to commission it again for another runner",
    ]);
    expect(story).toContainEqual([
      "BUDGET_CHECKED",
      "The print run closed without a confirmed receipt; printing again and the 2 placements need SGD 26.00, which fits the SGD 50.00 budget with SGD 24.00 to spare, so the print run goes out again",
    ]);
    await runPass();
    expect(await keysOf(id)).toHaveLength(2);
  });

  it("recommissions a switched-off runner's placement as attempt 2 for another runner", async () => {
    const field = await fieldCampaign(["A", "B"], "60.00");
    await placeAndProve(field, "A");
    await deactivate(field.runner.view.runner.id);
    await enrollTestRunner("Ben");
    expect((await runPass()).failed).toEqual([]);
    const id = field.campaign.id;
    expect(await keysOf(id)).toEqual([
      ["print:attempt:1", "COMPLETED"],
      ["spot:A:attempt:1", "COMPLETED"],
      ["spot:B:attempt:1", "CANCELLED"],
      ["spot:B:attempt:2", "DISPATCHED"],
    ]);
    const now = await campaignNow(id);
    const retry = now.tasks.find((task) => task.spotCode === "B" && task.attempt === 2);
    expect(await runnerOfTask(retry?.id ?? "")).toBe("Ben");
    expect(now.spots.map((spot) => [spot.code, spot.status, spot.firstPassStatus])).toEqual([
      ["A", "PASS", "PASS"],
      ["B", "PENDING", "MISS"],
    ]);
  });

  it("says no runner can take the recovery, once, and expires honestly at the deadline", async () => {
    const field = await fieldCampaign(["A", "B"], "60.00");
    await placeAndProve(field, "A");
    await deactivate(field.runner.view.runner.id);
    await runPass();
    await runPass();
    await runPass();
    const id = field.campaign.id;
    const waits = (await timeline(id)).filter(
      (event) => event.type === "RUNNER_UNAVAILABLE" && event.summary.startsWith("No enrolled"),
    );
    expect(waits).toHaveLength(1);
    expect(waits[0]?.summary).toBe(
      `No enrolled runner has an active link that lasts until ${field.campaign.deadline}, so the Spot B placement (attempt 2) waits for one`,
    );
    expect((await campaignNow(id)).status).toBe("REMEDIATING");
    const late = new Date(new Date(field.campaign.deadline).getTime() + 60_000);
    expect((await runPass(loopDeps({ now: () => late }))).failed).toEqual([]);
    const ended = await campaignNow(id);
    expect(ended.status).toBe("EXPIRED_INCOMPLETE");
    expect(ended.spots.find((spot) => spot.code === "B")?.status).toBe("MISS");
  });
});

describe("print retries", () => {
  it("prints again under a new key when the first print run expires unsettled", async () => {
    const started = await startedCampaign();
    const id = started.campaign.id;
    await db
      .update(physicalTasks)
      .set({ status: "EXPIRED" })
      .where(and(eq(physicalTasks.campaignId, id), eq(physicalTasks.type, "PRINT_AND_COLLECT")));
    expect((await runPass()).failed).toEqual([]);
    expect(await keysOf(id)).toEqual([
      ["print:attempt:1", "EXPIRED"],
      ["print:attempt:2", "DISPATCHED"],
    ]);
    const reprinted = await campaignNow(id);
    const second = { ...started, campaign: { ...reprinted, tasks: reprinted.tasks.slice(1) } };
    expect((await finishPrint(second, "6.00")).status).toBe(200);
    await runPass();
    expect((await keysOf(id)).map(([key]) => key)).toEqual([
      "print:attempt:1",
      "print:attempt:2",
      "spot:A:attempt:1",
      "spot:B:attempt:1",
    ]);
  });

  it("closes a print run whose receipt is confirmed when its runner is switched off", async () => {
    const started = await startedCampaign();
    expect((await sendPrintReceipt(started, "6.00")).body.status).toBe("CONFIRMED");
    await deactivate(started.runner.view.runner.id);
    await enrollTestRunner("Ben");
    await runPass();
    const view: CampaignView = await campaignNow(started.campaign.id);
    expect(view.tasks.map((task) => [task.type, task.spotCode, task.attempt, task.status])).toEqual(
      [
        ["PRINT_AND_COLLECT", null, 1, "COMPLETED"],
        ["PLACE_SPOT", "A", 1, "DISPATCHED"],
        ["PLACE_SPOT", "B", 1, "DISPATCHED"],
      ],
    );
    expect(await runnerOfTask(taskFor(view, "A").id)).toBe("Ben");
  });
});

describe("runner link expiry", () => {
  it("treats an expired link like a switched-off one", async () => {
    const started = await startedCampaign();
    await db
      .update(runners)
      .set({ tokenExpiresAt: new Date(Date.now() - 1_000) })
      .where(eq(runners.id, started.runner.view.runner.id));
    await asOperator("POST", "/operator/runners", {
      name: "Ben",
      expiresAt: inFuture(runnerLinkLifetimeMs),
    });
    await runPass();
    expect(await keysOf(started.campaign.id)).toEqual([
      ["print:attempt:1", "CANCELLED"],
      ["print:attempt:2", "DISPATCHED"],
    ]);
  });
});
