import { eq } from "drizzle-orm";
import type { ApiError, ExpenseView, TimelineEventView } from "@datum/core";
import { auditEvents, physicalTasks } from "@datum/db";
import { describe, expect, it } from "vitest";
import { startedCampaign, taskFor } from "../runners/campaign";
import { jpegFile, postForm, runnerCall, taskPath } from "../runners/calls";
import {
  campaignNow,
  finishPrint,
  printedCampaign,
  purchaseReading,
  sendPrintReceipt,
} from "../runners/print";
import { receiptPhoto } from "../receipts/receipt-image";
import { call, db, resetDatabaseBetweenTests } from "../support";
import { passStoppedMidway, runPass } from "./loop";

resetDatabaseBetweenTests();

const taskShape = async (campaignId: string) =>
  (await campaignNow(campaignId)).tasks.map((task) => [task.type, task.spotCode, task.status]);

const timeline = async (campaignId: string) =>
  (await call<TimelineEventView[]>("GET", `/campaigns/${campaignId}/timeline`)).body;

describe("print first, then placements once the print spend is real", () => {
  it("sends no placement while the print receipt waits for review", async () => {
    const started = await startedCampaign();
    const print = taskFor(started.campaign, null).id;
    const { token } = started.runner;
    await runnerCall("POST", taskPath(token, print, "accept"));
    const photo = await receiptPhoto({ merchant: "PRINT HUB PTE LTD", total: "6.00" });
    const sent = await postForm<ExpenseView>(taskPath(token, print, "expense"), {
      receipt: jpegFile(photo, "receipt.jpg"),
      amount: "6.00",
    });
    expect(sent.body.status).toBe("SUBMITTED");
    await runPass();
    expect(await taskShape(started.campaign.id)).toEqual([
      ["PRINT_AND_COLLECT", null, "SUBMITTED"],
    ]);
    expect(await runnerCall<ApiError>("POST", taskPath(token, print, "complete"))).toMatchObject({
      status: 409,
      body: { error: "RECEIPT_IN_REVIEW" },
    });
  });

  it("will not let a disputed receipt finish the print run", async () => {
    const started = await startedCampaign();
    const sent = await sendPrintReceipt(started, "6.00", {
      ...purchaseReading("6.00"),
      isPurchaseReceipt: false,
      concerns: ["printed NOT A REAL PURCHASE"],
    });
    expect(sent.body.status).toBe("DISPUTED");
    const print = taskFor(started.campaign, null).id;
    const done = await runnerCall<ApiError>(
      "POST",
      taskPath(started.runner.token, print, "complete"),
    );
    expect(done).toMatchObject({ status: 409, body: { error: "RECEIPT_DISPUTED" } });
    expect(done.body.message).toContain("not a purchase receipt");
    await runPass();
    expect((await taskShape(started.campaign.id)).length).toBe(1);
  });

  it("sends the placements once the print spend is confirmed and still fits", async () => {
    const { campaign } = await printedCampaign();
    expect(campaign.status).toBe("EXECUTING");
    expect(await taskShape(campaign.id)).toEqual([
      ["PRINT_AND_COLLECT", null, "COMPLETED"],
      ["PLACE_SPOT", "A", "DISPATCHED"],
      ["PLACE_SPOT", "B", "DISPATCHED"],
    ]);
    const keys = (await db.select().from(physicalTasks)).map((task) => task.idempotencyKey);
    expect(keys.sort()).toEqual([
      `campaign:${campaign.id}:print:attempt:1`,
      `campaign:${campaign.id}:spot:A:attempt:1`,
      `campaign:${campaign.id}:spot:B:attempt:1`,
    ]);
    expect(campaign.ledger).toMatchObject({
      confirmedSpend: { amount: "6.00", currency: "SGD" },
      committedSpend: { amount: "20.00", currency: "SGD" },
      remaining: { amount: "24.00", currency: "SGD" },
    });
    const checked = (await timeline(campaign.id)).filter(
      (event) => event.type === "BUDGET_CHECKED",
    );
    expect(checked.at(-1)).toMatchObject({
      actor: "DATUM_RULES",
      summary:
        "Print spend is confirmed at SGD 6.00; the 2 placements need SGD 20.00, which fits the SGD 50.00 budget with SGD 24.00 to spare, so they go out now",
    });
  });

  it("stops at NEEDS_APPROVAL when the real print cost leaves too little for the placements", async () => {
    const started = await startedCampaign();
    expect((await finishPrint(started, "35.00")).status).toBe(200);
    await runPass();
    const campaign = await campaignNow(started.campaign.id);
    expect(campaign.status).toBe("NEEDS_APPROVAL");
    expect(await taskShape(campaign.id)).toEqual([["PRINT_AND_COLLECT", null, "COMPLETED"]]);
    expect(campaign.ledger?.remaining).toEqual({ amount: "15.00", currency: "SGD" });
    expect((await timeline(campaign.id)).at(-1)).toMatchObject({
      type: "APPROVAL_REQUESTED",
      actor: "DATUM_RULES",
      summary:
        "Stopped before sending the placements: SGD 35.00 is confirmed for printing and the 2 placements need SGD 20.00, SGD 5.00 over the SGD 50.00 budget, so they need the customer's approval",
    });
    await runPass();
    expect((await campaignNow(campaign.id)).status).toBe("NEEDS_APPROVAL");
  });

  it("commissions each placement exactly once when the worker stops mid-way and restarts", async () => {
    const started = await startedCampaign();
    await finishPrint(started, "6.00");
    const stopped = await passStoppedMidway(1);
    expect(stopped).toMatchObject({ name: "AbortError" });
    expect(await taskShape(started.campaign.id)).toEqual([
      ["PRINT_AND_COLLECT", null, "COMPLETED"],
      ["PLACE_SPOT", "A", "DISPATCHED"],
    ]);
    expect((await runPass()).failed).toEqual([]);
    await runPass();
    expect(await taskShape(started.campaign.id)).toEqual([
      ["PRINT_AND_COLLECT", null, "COMPLETED"],
      ["PLACE_SPOT", "A", "DISPATCHED"],
      ["PLACE_SPOT", "B", "DISPATCHED"],
    ]);
    const created = await db.select().from(auditEvents).where(eq(auditEvents.type, "TASK_CREATED"));
    expect(created).toHaveLength(3);
  });
});
