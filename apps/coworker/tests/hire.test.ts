import { eq } from "drizzle-orm";
import { coworkerTasks } from "@datum/db";
import { HttpStatusError, type TaskEventBody } from "@datum/masumi";
import { describe, expect, it } from "vitest";
import type { Coworker } from "../src/context";
import { db, harness, resetDatabaseBetweenTests, type Harness } from "./support/harness";
import { campaignsFor, commentRows, hireRow, onlyCampaign } from "./support/rows";

resetDatabaseBetweenTests();

const proposals = (h: Harness) =>
  h.world.events.filter((event) => event.comment?.startsWith("Datum drafted your campaign"));

const withPostEvent = (
  h: Harness,
  postEvent: (taskId: string, body: TaskEventBody) => ReturnType<Coworker["core"]["postEvent"]>,
): Coworker => ({ ...h.coworker, core: { ...h.coworker.core, postEvent } });

const isPlainComment = (body: TaskEventBody) => !("status" in body) && !("masumiPayment" in body);

describe("a READY Task with a complete brief becomes one Datum campaign", () => {
  it("starts the Task, plans one campaign and posts the proposal link before asking for payment", async () => {
    const h = harness();
    await h.passesUntil(() => Promise.resolve(h.world.attached !== null), 1_000);
    for (let restart = 0; restart < 3; restart += 1) await h.pass();

    const campaign = await onlyCampaign(h.world.taskId);
    expect(campaign.status).toBe("AWAITING_APPROVAL");
    expect(h.world.calls).toMatchObject({ start: 1, terms: 1, attach: 1 });
    expect(h.briefModel.prompts).toHaveLength(1);
    expect(h.briefModel.prompts[0]?.user).toContain("Reply with one sentence.");

    const [proposal] = proposals(h);
    expect(proposals(h)).toHaveLength(1);
    expect(proposal?.comment).toContain(
      `Datum drafted your campaign. Review and approve it once here: https://datum.test/campaigns/${campaign.id}`,
    );
    expect(proposal?.comment).toContain(
      "Kopi Lab: 2 spots (A Amoy Street cafe window; B Telok Ayer notice board)",
    );
    expect(proposal?.comment).toContain("an estimated SGD 14.00 of the SGD 50.00 budget");
    expect(proposal?.comment).toContain(
      "only once the payment for this Task is confirmed in escrow",
    );

    const paymentEvent = h.world.events.findIndex(
      (event) => event.comment === "Datum attached signed Masumi payment terms.",
    );
    expect(h.world.events.findIndex((event) => event === proposal)).toBeLessThan(paymentEvent);
    expect(await commentRows(h.world.taskId)).toEqual([
      expect.objectContaining({ purpose: "PROPOSAL", eventId: proposal?.id }),
    ]);
  });

  it("reconciles a proposal comment whose response was lost instead of posting it twice", async () => {
    const h = harness();
    let lose = true;
    const losing = withPostEvent(h, async (taskId, body) => {
      const event = await h.coworker.core.postEvent(taskId, body);
      if (lose && isPlainComment(body)) {
        lose = false;
        throw new TypeError("fetch failed");
      }
      return event;
    });
    await h.passesUntil(() => Promise.resolve(h.world.attached !== null), 1_000, {
      coworker: losing,
    });

    expect(lose).toBe(false);
    expect(proposals(h)).toHaveLength(1);
    expect(h.lines).toContain(`Task ${h.world.taskId}: the PROPOSAL comment was already posted`);
    expect((await commentRows(h.world.taskId))[0]?.eventId).toBe(proposals(h)[0]?.id);
  });

  it("never creates a second campaign for one Task, even if its intake runs again", async () => {
    const h = harness();
    await h.passesUntil(async () => (await hireRow(h.world.taskId))?.stage === "CAMPAIGN", 1_000);
    await db
      .update(coworkerTasks)
      .set({ stage: "INTAKE" })
      .where(eq(coworkerTasks.sokosumiTaskId, h.world.taskId));
    await h.pass();
    expect(await campaignsFor(h.world.taskId)).toHaveLength(1);
    expect((await hireRow(h.world.taskId))?.stage).toBe("CAMPAIGN");
  });

  it("logs the human action for a grant request and retries the same Task", async () => {
    const h = harness();
    let blocked = true;
    const guarded = withPostEvent(h, (taskId, body) =>
      blocked && "status" in body && body.status === "RUNNING"
        ? Promise.reject(new HttpStatusError("Sokosumi Core", 403, "Forbidden", "grant_required"))
        : h.coworker.core.postEvent(taskId, body),
    );
    await h.pass(guarded);
    expect(h.lines).toContain(
      `Task ${h.world.taskId} is waiting for a person: The Task owner must approve Datum's Vendor access request in their Personal Workspace notifications on Sokosumi. Datum retries this same Task after that.`,
    );
    expect(h.world.taskStatus).toBe("READY");
    expect((await hireRow(h.world.taskId))?.stage).toBe("INTAKE");

    blocked = false;
    await h.pass(guarded);
    expect(h.world.taskStatus).toBe("RUNNING");
    expect(h.world.calls.start).toBe(1);
  });
});
