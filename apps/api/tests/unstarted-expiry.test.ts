import type { CampaignReceiptView } from "@datum/core";
import { campaignReceipts } from "@datum/db";
import { describe, expect, it } from "vitest";
import { expireUnstartedCampaign } from "../src/goal-loop/unstarted";
import { afterDeadline, never, statusOf } from "./coworker-hire";
import { plannedCampaign } from "./flows";
import { loopDeps } from "./goal-loop/loop";
import { approvedCampaign } from "./runners/campaign";
import { call, db, resetDatabaseBetweenTests } from "./support";

resetDatabaseBetweenTests();

describe("a campaign that never started ends at its deadline", () => {
  it("leaves a campaign alone before its deadline", async () => {
    const planned = await plannedCampaign();
    expect(await expireUnstartedCampaign(loopDeps(), planned.id, never)).toBe(false);
    expect(await statusOf(planned.id)).toBe("AWAITING_APPROVAL");
  });

  it("expires an unapproved campaign without publishing a receipt", async () => {
    const planned = await plannedCampaign();
    const deps = afterDeadline(planned.deadline);
    expect(await expireUnstartedCampaign(deps, planned.id, never)).toBe(true);
    expect(await statusOf(planned.id)).toBe("EXPIRED_INCOMPLETE");
    expect(await db.select().from(campaignReceipts)).toHaveLength(0);
    expect(await expireUnstartedCampaign(deps, planned.id, never)).toBe(false);
  });

  it("expires an approved campaign that never started with a receipt of no physical work", async () => {
    const approved = await approvedCampaign();
    expect(
      await expireUnstartedCampaign(afterDeadline(approved.deadline), approved.id, never),
    ).toBe(true);
    const receipt = await call<CampaignReceiptView>("GET", `/campaigns/${approved.id}/receipt`);
    expect(receipt.status).toBe(200);
    expect(receipt.body).toMatchObject({
      status: "EXPIRED_INCOMPLETE",
      actual: { spotsPassed: 0, completedAt: null, spend: { amount: "0.00" } },
      executors: [],
      masumi: null,
    });
  });
});
