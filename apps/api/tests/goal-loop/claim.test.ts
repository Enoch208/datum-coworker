import { and, eq } from "drizzle-orm";
import type { CampaignView, TimelineEventView } from "@datum/core";
import { auditEvents, physicalTasks, spots } from "@datum/db";
import { afterAll, describe, expect, it } from "vitest";
import { withCampaignLock } from "../../src/goal-loop/claim";
import { approvedCampaign, startedCampaign, taskFor } from "../runners/campaign";
import { call, db, resetDatabaseBetweenTests } from "../support";
import { loopDeps, runPass, secondWorkerDb } from "./loop";

resetDatabaseBetweenTests();

const otherDb = secondWorkerDb();
afterAll(async () => {
  await otherDb.$client.end();
});

async function overdue(taskId: string): Promise<void> {
  await db
    .update(physicalTasks)
    .set({ dueBy: new Date(Date.now() - 60_000) })
    .where(eq(physicalTasks.id, taskId));
}

const expiries = () => db.select().from(auditEvents).where(eq(auditEvents.type, "TASK_EXPIRED"));

describe("the worker's claim on a campaign", () => {
  it("expires a placement past its due time, releases its hold and marks the spot missed", async () => {
    const { campaign } = await startedCampaign();
    await overdue(taskFor(campaign, "A").id);
    const report = await runPass();
    expect(report).toEqual({ ticked: [campaign.id], skipped: [], failed: [] });
    const view = await call<CampaignView>("GET", `/campaigns/${campaign.id}`);
    expect(taskFor(view.body, "A").status).toBe("EXPIRED");
    expect(view.body.spots.find((spot) => spot.code === "A")).toMatchObject({
      status: "MISS",
      firstPassStatus: "MISS",
    });
    expect(view.body.ledger?.committedSpend).toEqual({ amount: "16.00", currency: "SGD" });
    const timeline = await call<TimelineEventView[]>("GET", `/campaigns/${campaign.id}/timeline`);
    expect(timeline.body.at(-1)).toMatchObject({
      type: "TASK_EXPIRED",
      actor: "DATUM_RULES",
      summary:
        "Closed the Spot A placement (attempt 1) as expired: it passed its due time, so its SGD 10.00 hold on the budget is released",
    });
  });

  it("does nothing on a later pass once nothing is overdue", async () => {
    const { campaign } = await startedCampaign();
    await overdue(taskFor(campaign, "A").id);
    await runPass();
    await runPass();
    expect(await expiries()).toHaveLength(1);
  });

  it("leaves campaigns that are not executing alone", async () => {
    const approved = await approvedCampaign();
    expect(await runPass()).toEqual({ ticked: [], skipped: [], failed: [] });
    const reply = await call<CampaignView>("GET", `/campaigns/${approved.id}`);
    expect(reply.body.status).toBe("APPROVED");
  });

  it("skips a campaign another worker holds and acts on it once that worker lets go", async () => {
    const { campaign } = await startedCampaign();
    await overdue(taskFor(campaign, "A").id);
    let release = (): void => undefined;
    let acquired = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const locked = new Promise<void>((resolve) => {
      acquired = resolve;
    });
    const holder = withCampaignLock(otherDb, campaign.id, () => {
      acquired();
      return held;
    });
    await locked;
    expect(await runPass()).toEqual({ ticked: [], skipped: [campaign.id], failed: [] });
    expect(await expiries()).toHaveLength(0);
    release();
    expect(await holder).toEqual({ acquired: true, result: undefined });
    expect(await runPass()).toMatchObject({ ticked: [campaign.id] });
    expect(await expiries()).toHaveLength(1);
  });

  it("expires a task exactly once when two workers pass at the same moment", async () => {
    const { campaign } = await startedCampaign();
    await overdue(taskFor(campaign, "A").id);
    const reports = await Promise.all([runPass(), runPass(loopDeps({ db: otherDb }))]);
    expect(reports.flatMap((report) => report.failed)).toEqual([]);
    expect(await expiries()).toHaveLength(1);
    const [spot] = await db
      .select()
      .from(spots)
      .where(and(eq(spots.campaignId, campaign.id), eq(spots.code, "A")));
    expect(spot?.status).toBe("MISS");
  });
});
