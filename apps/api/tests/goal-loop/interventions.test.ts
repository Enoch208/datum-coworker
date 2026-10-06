import { eq } from "drizzle-orm";
import type { ApiError, CampaignView, ExpenseView, TimelineEventView } from "@datum/core";
import { interventions, physicalTasks } from "@datum/db";
import { describe, expect, it } from "vitest";
import { startedCampaign, taskFor } from "../runners/campaign";
import { runnerCall, taskPath } from "../runners/calls";
import { campaignNow, purchaseReading, sendPrintReceipt } from "../runners/print";
import { call, db, resetDatabaseBetweenTests } from "../support";
import { fieldCampaign, markDoneWithoutValidPhoto, placeAndProve } from "./field";
import { runPass } from "./loop";

resetDatabaseBetweenTests();

const timeline = async (campaignId: string) =>
  (await call<TimelineEventView[]>("GET", `/campaigns/${campaignId}/timeline`)).body;

const placementKeys = async (campaignId: string) =>
  (await db.select().from(physicalTasks).where(eq(physicalTasks.campaignId, campaignId)))
    .filter((task) => task.type === "PLACE_SPOT")
    .map((task) => task.idempotencyKey.replace(`campaign:${campaignId}:`, ""))
    .sort();

const doubtful = {
  ...purchaseReading("6.00"),
  isPurchaseReceipt: false,
  concerns: ["printed NOT A REAL PURCHASE"],
};

describe("post-approval interventions are measured (Gate 5)", () => {
  it("raises the cap on the customer's word, counts it once and lets the loop recover", async () => {
    const field = await fieldCampaign(["A", "B", "C", "D"], "50.00");
    await placeAndProve(field, "A");
    await placeAndProve(field, "B");
    await markDoneWithoutValidPhoto(field, "C");
    await placeAndProve(field, "D");
    await runPass();
    const id = field.campaign.id;
    expect((await campaignNow(id)).status).toBe("NEEDS_APPROVAL");
    const raised = await call<CampaignView>("POST", `/campaigns/${id}/budget`, {
      budget: { amount: "60.00", currency: "SGD" },
      approvedBy: "Mei Tan",
    });
    expect(raised).toMatchObject({
      status: 200,
      body: { status: "EXECUTING", budget: { amount: "60.00" }, approval: { version: 2 } },
    });
    expect(raised.body.ledger?.remaining).toEqual({ amount: "14.00", currency: "SGD" });
    await runPass();
    expect(await placementKeys(id)).toContain("spot:C:attempt:2");
    const rows = await db.select().from(interventions);
    expect(rows).toMatchObject([
      {
        campaignId: id,
        actor: "CUSTOMER",
        actorName: "Mei Tan",
        action: "BUDGET_RAISED",
        reason: "raised the approved budget from SGD 50.00 to SGD 60.00",
      },
    ]);
    expect((await timeline(id)).map((event) => event.summary)).toContain(
      "Counted a post-approval intervention: Mei Tan (customer) raised the approved budget from SGD 50.00 to SGD 60.00",
    );
  });

  it("refuses a cap that is not higher, or a campaign that is not waiting", async () => {
    const field = await fieldCampaign(["A"], "60.00");
    const id = field.campaign.id;
    const notWaiting = await call<ApiError>("POST", `/campaigns/${id}/budget`, {
      budget: { amount: "90.00", currency: "SGD" },
      approvedBy: "Mei Tan",
    });
    expect(notWaiting).toMatchObject({ status: 409, body: { error: "INVALID_STATE" } });
    expect(await db.select().from(interventions)).toEqual([]);
  });

  it("stops at NEEDS_APPROVAL on a disputed print receipt and counts the customer's acceptance", async () => {
    const started = await startedCampaign();
    const id = started.campaign.id;
    const sent = await sendPrintReceipt(started, "6.00", doubtful);
    expect(sent.body.status).toBe("DISPUTED");
    await runPass();
    const stopped = await campaignNow(id);
    expect(stopped.status).toBe("NEEDS_APPROVAL");
    expect((await timeline(id)).at(-1)?.summary).toMatch(
      /^Stopped until a person reviews a SGD 6\.00 receipt: The receipt reader says this image is not a purchase receipt/,
    );
    const accepted = await call<CampaignView>(
      "POST",
      `/campaigns/${id}/expenses/${sent.body.id}/accept`,
      {
        acceptedBy: "Mei Tan",
        reason: "I paid Print Hub in cash; the shop printed a test header.",
      },
    );
    expect(accepted.body.status).toBe("EXECUTING");
    expect(accepted.body.ledger?.confirmedSpend).toEqual({ amount: "6.00", currency: "SGD" });
    expect(await db.select().from(interventions)).toMatchObject([
      { actor: "CUSTOMER", action: "EXPENSE_ACCEPTED" },
    ]);
    const print = taskFor(started.campaign, null).id;
    const done = await runnerCall("POST", taskPath(started.runner.token, print, "complete"));
    expect(done.status).toBe(200);
    await runPass();
    expect(await placementKeys(id)).toEqual(["spot:A:attempt:1", "spot:B:attempt:1"]);
  });

  it("resumes on its own, with nothing counted, when the runner sends a receipt that passes", async () => {
    const started = await startedCampaign();
    const id = started.campaign.id;
    await sendPrintReceipt(started, "6.00", doubtful);
    await runPass();
    expect((await campaignNow(id)).status).toBe("NEEDS_APPROVAL");
    const second = await sendPrintReceipt(
      started,
      "6.00",
      purchaseReading("6.00"),
      "PRINT HUB PTE LTD (REPRINT)",
    );
    expect(second.body.status).toBe("CONFIRMED");
    await runPass();
    expect((await campaignNow(id)).status).toBe("EXECUTING");
    expect(await db.select().from(interventions)).toEqual([]);
  });

  it("will not accept a receipt that is not an open dispute", async () => {
    const started = await startedCampaign();
    const sent = await sendPrintReceipt(started, "6.00");
    const reply = await call<ExpenseView & ApiError>(
      "POST",
      `/campaigns/${started.campaign.id}/expenses/${sent.body.id}/accept`,
      { acceptedBy: "Mei Tan", reason: "Looks fine" },
    );
    expect(reply).toMatchObject({ status: 409, body: { error: "NOT_DISPUTED" } });
  });
});
