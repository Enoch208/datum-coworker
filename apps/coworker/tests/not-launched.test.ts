import { describe, expect, it } from "vitest";
import { completeBrief, futureDeadline } from "./support/briefs";
import { harness, resetDatabaseBetweenTests } from "./support/harness";
import { commentRows, evidenceRows, hireRow, onlyCampaign, receiptRows } from "./support/rows";

resetDatabaseBetweenTests();

describe("a hired campaign that is never approved", () => {
  it("expires at its deadline and ends the Task without claiming the payment", async () => {
    const h = harness();
    h.briefModel.answer = completeBrief(futureDeadline(1));
    await h.passesUntil(async () => (await hireRow(h.world.taskId))?.fundsLockedAt != null, 30_000);
    const campaign = await onlyCampaign(h.world.taskId);
    h.clock.advance(campaign.deadline.getTime() + 60_000 - h.clock.now());

    await h.pass();
    for (let restart = 0; restart < 3; restart += 1) await h.pass();

    expect((await onlyCampaign(h.world.taskId)).status).toBe("EXPIRED_INCOMPLETE");
    expect(await receiptRows(campaign.id)).toHaveLength(0);
    const ended = h.world.events.filter((event) => event.status === "FAILED");
    expect(ended).toHaveLength(1);
    expect(ended[0]?.comment).toMatch(
      /^Datum did not run this campaign: it was not approved before its deadline \(\d{4}-\d{2}-\d{2} \d{2}:\d{2} SGT\)\. No cards were printed or placed and nothing was spent\. Datum submitted no result for this Task's payment, so it does not claim it\.$/,
    );
    expect(h.world.taskStatus).toBe("FAILED");
    expect(h.world.calls).toMatchObject({ submit: 0, complete: 0 });
    expect(await evidenceRows(h.world.taskId)).toHaveLength(0);
    expect(await hireRow(h.world.taskId)).toMatchObject({
      stage: "ENDED",
      stopReason: `Campaign ${campaign.id} did not start before its deadline; no result was submitted`,
    });
    expect((await commentRows(h.world.taskId)).map((row) => row.purpose)).toEqual([
      "PROPOSAL",
      "ENDED",
    ]);
  });
});
