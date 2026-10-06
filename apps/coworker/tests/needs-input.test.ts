import { describe, expect, it } from "vitest";
import { briefWithoutDeadlineOrBudget, completeBrief } from "./support/briefs";
import { harness, resetDatabaseBetweenTests, type Harness } from "./support/harness";
import { campaignsFor, commentRows, hireRow } from "./support/rows";

resetDatabaseBetweenTests();

const asks = (h: Harness) => h.world.events.filter((event) => event.status === "INPUT_REQUIRED");

async function askedOnce(): Promise<Harness> {
  const h = harness();
  h.briefModel.answer = briefWithoutDeadlineOrBudget();
  await h.passesUntil(async () => (await hireRow(h.world.taskId))?.stage === "NEEDS_INPUT", 1_000);
  for (let restart = 0; restart < 3; restart += 1) await h.pass();
  return h;
}

describe("a Task whose brief is incomplete", () => {
  it("gets one comment listing exactly what is missing, and no campaign or payment", async () => {
    const h = await askedOnce();
    expect(asks(h)).toHaveLength(1);
    expect(asks(h)[0]?.comment).toBe(
      [
        "Datum needs a few more details before it can plan this campaign:",
        "- The deadline: the date and time every card must be up",
        "- The total budget in SGD, for example SGD 60",
        "",
        "Reply on this Task with the details and set it back to Ready. Datum reads the description and your replies again and drafts the campaign.",
      ].join("\n"),
    );
    expect(h.world.taskStatus).toBe("INPUT_REQUIRED");
    expect(await campaignsFor(h.world.taskId)).toHaveLength(0);
    expect(h.world.calls).toMatchObject({ terms: 0, attach: 0 });
    expect(await commentRows(h.world.taskId)).toEqual([
      expect.objectContaining({ purpose: "INPUT_REQUEST", round: 1, taskStatus: "INPUT_REQUIRED" }),
    ]);
  });

  it("reads the brief again with the customer's reply once the Task is READY again", async () => {
    const h = await askedOnce();
    h.world.events.push({
      id: "evt_reply",
      taskId: h.world.taskId,
      createdAt: new Date(h.clock.now()).toISOString(),
      status: null,
      comment: "Cards up by tomorrow 6pm, budget SGD 50.",
      actor: { type: "user", id: "user_owner" },
    });
    h.world.taskStatus = "READY";
    h.briefModel.answer = completeBrief();

    await h.passesUntil(async () => (await campaignsFor(h.world.taskId)).length > 0, 1_000);
    expect(h.briefModel.prompts.at(-1)?.user).toContain("Cards up by tomorrow 6pm, budget SGD 50.");
    expect(h.world.events.filter((event) => event.status === "RUNNING")).toHaveLength(2);
    expect(asks(h)).toHaveLength(1);
    expect((await hireRow(h.world.taskId))?.stage).toBe("CAMPAIGN");
  });
});
