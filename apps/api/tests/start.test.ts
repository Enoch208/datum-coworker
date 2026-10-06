import { eq } from "drizzle-orm";
import type { ApiError, CampaignView, TimelineEventView } from "@datum/core";
import { auditEvents, campaigns, physicalTasks } from "@datum/db";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { editCopy, plannedCampaign } from "./flows";
import { enrollTestRunner } from "./runners/enroll";
import { approvedCampaign, start, startedCampaign } from "./runners/campaign";
import { call, callApp, db, resetDatabaseBetweenTests, testDeps } from "./support";

resetDatabaseBetweenTests();

const taskRows = () => db.select().from(physicalTasks);

describe("POST /campaigns/:id/start (Gate 3)", () => {
  it("commissions one print run and one placement per spot under deterministic keys", async () => {
    const { campaign, runner } = await startedCampaign();
    expect(campaign.status).toBe("EXECUTING");
    expect(campaign.tasks.map((task) => [task.type, task.spotCode, task.status])).toEqual([
      ["PRINT_AND_COLLECT", null, "DISPATCHED"],
      ["PLACE_SPOT", "A", "DISPATCHED"],
      ["PLACE_SPOT", "B", "DISPATCHED"],
    ]);
    const rows = await taskRows();
    expect(rows.map((row) => row.idempotencyKey).sort()).toEqual([
      `campaign:${campaign.id}:print:attempt:1`,
      `campaign:${campaign.id}:spot:A:attempt:1`,
      `campaign:${campaign.id}:spot:B:attempt:1`,
    ]);
    for (const row of rows) {
      expect(row).toMatchObject({
        adapter: "LOCAL_ENROLLED_RUNNER",
        runnerId: runner.view.runner.id,
        externalTaskRef: row.id,
        dueBy: new Date(campaign.deadline),
        assetVersion: 1,
      });
      expect(row.dispatchedAt).not.toBeNull();
    }
    expect(campaign.tasks.every((task) => task.adapter === "LOCAL_ENROLLED_RUNNER")).toBe(true);
  });

  it("commits each step's approved estimate and gives each task its cards", async () => {
    const { campaign } = await startedCampaign();
    const rows = await taskRows();
    const print = rows.find((row) => row.type === "PRINT_AND_COLLECT");
    expect(print).toMatchObject({ copies: 4, estimatedCostMinor: 600, committedCostMinor: 600 });
    expect(print?.assetUrls).toEqual([
      `https://datum.test/assets/${campaign.id}/v1/A.pdf`,
      `https://datum.test/assets/${campaign.id}/v1/B.pdf`,
    ]);
    expect(print?.instructions).toMatch(/^Print 4 copies of the approved A6 cards/);
    expect(campaign.ledger).toEqual({
      approvedBudget: { amount: "50.00", currency: "SGD" },
      confirmedSpend: { amount: "0.00", currency: "SGD" },
      committedSpend: { amount: "26.00", currency: "SGD" },
      remaining: { amount: "24.00", currency: "SGD" },
      expenses: [],
    });
  });

  it("returns the same tasks when started again", async () => {
    const { campaign } = await startedCampaign();
    const again = await start(campaign.id);
    expect(again).toMatchObject({ status: 200, body: { status: "EXECUTING" } });
    expect(again.body.tasks).toEqual(campaign.tasks);
    expect(await taskRows()).toHaveLength(3);
    const created = await db.select().from(auditEvents).where(eq(auditEvents.type, "TASK_CREATED"));
    expect(created).toHaveLength(3);
  });

  it("refuses to start without an approval", async () => {
    await enrollTestRunner();
    const planned = await plannedCampaign();
    expect(await start(planned.id)).toMatchObject({
      status: 409,
      body: { error: "NO_APPROVAL" },
    });
    expect(await taskRows()).toEqual([]);
  });

  it("refuses to start once the copy changed after approval", async () => {
    await enrollTestRunner();
    const approved = await approvedCampaign();
    await editCopy(approved.id, { headline: "Oat flat whites on us", subcopy: "Show this card." });
    expect(await start(approved.id)).toMatchObject({
      status: 409,
      body: { error: "APPROVAL_NOT_CURRENT" },
    });
    expect(await taskRows()).toEqual([]);
  });

  it("refuses to start with no enrolled runner and changes nothing", async () => {
    const approved = await approvedCampaign();
    expect(await start(approved.id)).toMatchObject({ status: 409, body: { error: "NO_RUNNER" } });
    const reply = await call<CampaignView>("GET", `/campaigns/${approved.id}`);
    expect(reply.body.status).toBe("APPROVED");
    expect(await taskRows()).toEqual([]);
  });

  it("refuses to start without explicit cost rates", async () => {
    await enrollTestRunner();
    const approved = await approvedCampaign();
    const unpriced = createApp(
      testDeps({ rates: { configured: false, missing: ["DATUM_PRINT_COST_PER_COPY"] } }),
    );
    const reply = await callApp<ApiError>(unpriced, "POST", `/campaigns/${approved.id}/start`);
    expect(reply).toMatchObject({ status: 503, body: { error: "COST_RATES_MISSING" } });
  });

  it("refuses to start after the deadline", async () => {
    await enrollTestRunner();
    const approved = await approvedCampaign();
    await db
      .update(campaigns)
      .set({ deadline: new Date(Date.now() - 1_000) })
      .where(eq(campaigns.id, approved.id));
    expect(await start(approved.id)).toMatchObject({
      status: 409,
      body: { error: "DEADLINE_PASSED" },
    });
  });

  it("stops at NEEDS_APPROVAL instead of overspending a budget the plan exceeds", async () => {
    await enrollTestRunner();
    const approved = await approvedCampaign({ budget: { amount: "20.00", currency: "SGD" } });
    const reply = await start(approved.id);
    expect(reply).toMatchObject({ status: 200, body: { status: "NEEDS_APPROVAL", tasks: [] } });
    expect(await taskRows()).toEqual([]);
    const events = await call<TimelineEventView[]>("GET", `/campaigns/${approved.id}/timeline`);
    expect(events.body.at(-1)).toMatchObject({
      type: "APPROVAL_REQUESTED",
      actor: "DATUM_RULES",
      summary:
        "Stopped before commissioning anything: the approved plan needs SGD 26.00, SGD 6.00 more than the SGD 20.00 budget, so it needs the customer's approval",
    });
  });

  it("tells the timeline what was commissioned and who holds it", async () => {
    const { campaign } = await startedCampaign();
    const events = await call<TimelineEventView[]>("GET", `/campaigns/${campaign.id}/timeline`);
    const execution = events.body.filter((event) => event.type.startsWith("TASK_"));
    expect(execution.map(({ actor, summary }) => [actor, summary])).toEqual([
      [
        "DATUM_RULES",
        "Commissioned the print run of 4 copies (attempt 1), holding SGD 6.00 of the budget",
      ],
      ["DATUM_RULES", "Sent the print run to Ana, a local enrolled runner"],
      [
        "DATUM_RULES",
        "Commissioned the Spot A placement (attempt 1), holding SGD 10.00 of the budget",
      ],
      ["DATUM_RULES", "Sent the Spot A placement to Ana, a local enrolled runner"],
      [
        "DATUM_RULES",
        "Commissioned the Spot B placement (attempt 1), holding SGD 10.00 of the budget",
      ],
      ["DATUM_RULES", "Sent the Spot B placement to Ana, a local enrolled runner"],
    ]);
  });
});
