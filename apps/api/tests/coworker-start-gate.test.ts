import { physicalTasks } from "@datum/db";
import { describe, expect, it } from "vitest";
import { hireThroughTask, lockEscrow, statusOf } from "./coworker-hire";
import { plannedCampaign } from "./flows";
import { approvedCampaign, start } from "./runners/campaign";
import { enrollTestRunner } from "./runners/enroll";
import { db, resetDatabaseBetweenTests } from "./support";

resetDatabaseBetweenTests();

describe("a campaign hired through a Sokosumi Task starts only after approval and escrow", () => {
  it("refuses to start an approved campaign until its Task's escrow is confirmed", async () => {
    await enrollTestRunner();
    const approved = await approvedCampaign();
    await hireThroughTask(approved.id);

    const refused = await start(approved.id);
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ error: "AWAITING_PAYMENT" });
    expect(await statusOf(approved.id)).toBe("APPROVED");
    expect(await db.select().from(physicalTasks)).toHaveLength(0);

    await lockEscrow();
    const started = await start(approved.id);
    expect(started.status).toBe(200);
    expect(started.body.status).toBe("EXECUTING");
    expect(await db.select().from(physicalTasks)).toHaveLength(1);
  });

  it("never starts an unapproved campaign, even with its escrow locked", async () => {
    await enrollTestRunner();
    const planned = await plannedCampaign();
    await hireThroughTask(planned.id);
    await lockEscrow();

    const refused = await start(planned.id);
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ error: "NO_APPROVAL" });
    expect(await db.select().from(physicalTasks)).toHaveLength(0);
  });
});
