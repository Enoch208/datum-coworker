import { eq } from "drizzle-orm";
import type { CampaignView, ExpenseView, TimelineEventView } from "@datum/core";
import { expenses } from "@datum/db";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { ReceiptReader } from "../src/receipts/reader";
import {
  failingReceiptReader,
  fixtureReceiptReader,
  receiptFixture,
} from "./receipts/fixture-reader";
import { receiptPhoto } from "./receipts/receipt-image";
import { startedCampaign, taskFor } from "./runners/campaign";
import { campaignNow, finishPrint } from "./runners/print";
import { runPass } from "./goal-loop/loop";
import { jpegFile, postForm, runnerCall, taskPath } from "./runners/calls";
import { callApp, db, resetDatabaseBetweenTests, testDeps } from "./support";

resetDatabaseBetweenTests();

const matching = () => fixtureReceiptReader(receiptFixture("receipt-print-hub"));

async function printReady(reader: ReceiptReader | null) {
  const target = createApp(testDeps({ receiptReader: reader }));
  const { campaign, runner } = await startedCampaign();
  const taskId = taskFor(campaign, null).id;
  await runnerCall("POST", taskPath(runner.token, taskId, "accept"));
  const send = async (fields: Record<string, string | Blob>) =>
    postForm<ExpenseView>(taskPath(runner.token, taskId, "expense"), fields, target);
  const ledger = async () =>
    (await callApp<CampaignView>(target, "GET", `/campaigns/${campaign.id}`)).body.ledger;
  return { campaign, runner, taskId, send, ledger, target };
}

const receipt = async (total = "13.80") =>
  jpegFile(await receiptPhoto({ merchant: "PRINT HUB PTE LTD", total }), "receipt.jpg");

describe("POST /runner/:token/tasks/:taskId/expense (spec 9)", () => {
  it("confirms an entered amount the receipt agrees with and moves it into spend", async () => {
    const reader = matching();
    const { send, ledger } = await printReady(reader);
    const reply = await send({ receipt: await receipt(), amount: "13.80", merchant: "Print Hub" });
    expect(reply.status).toBe(201);
    expect(reply.body).toMatchObject({
      amount: { amount: "13.80", currency: "SGD" },
      merchant: "Print Hub",
      status: "CONFIRMED",
      explanation:
        "The amount read from the receipt from PRINT HUB PTE LTD matches the entered SGD 13.80.",
    });
    expect(reply.body.receiptUrl).toMatch(/^https:\/\/datum\.test\/evidence\/[0-9a-f]{32}\.jpg$/);
    expect(reader.calls).toHaveLength(1);
    expect(await ledger()).toMatchObject({
      approvedBudget: { amount: "50.00" },
      confirmedSpend: { amount: "13.80" },
      committedSpend: { amount: "0.00" },
      remaining: { amount: "36.20" },
      expenses: [{ id: reply.body.id, status: "CONFIRMED" }],
    });
  });

  it("disputes an amount the receipt does not show and keeps the commitment", async () => {
    const { send, ledger } = await printReady(matching());
    const reply = await send({ receipt: await receipt(), amount: "12.00" });
    expect(reply.body).toMatchObject({
      status: "DISPUTED",
      explanation:
        "The amount read from the receipt from PRINT HUB PTE LTD is SGD 13.80, but SGD 12.00 was entered, so it needs review.",
    });
    expect(await ledger()).toMatchObject({
      confirmedSpend: { amount: "0.00" },
      committedSpend: { amount: "6.00" },
      remaining: { amount: "44.00" },
    });
  });

  it("never lets the reader's number become money", async () => {
    const reader = fixtureReceiptReader({
      ...(receiptFixture("receipt-print-hub") as object),
      total: "99.00",
    });
    const { send } = await printReady(reader);
    const reply = await send({ receipt: await receipt(), amount: "13.80" });
    expect(reply.body).toMatchObject({ status: "DISPUTED", amount: { amount: "13.80" } });
    const [row] = await db.select().from(expenses);
    expect(row?.amountMinor).toBe(1_380);
  });

  it("disputes a matching amount on a receipt marked as not a real purchase", async () => {
    const reader = fixtureReceiptReader(receiptFixture("receipt-not-a-real-purchase"));
    const { send, ledger } = await printReady(reader);
    const photo = await receiptPhoto({
      notice: "UI LANE LOCAL TEST / NOT A REAL PURCHASE",
      merchant: "PRINT HUB PTE LTD",
      total: "13.80",
    });
    const reply = await send({ receipt: jpegFile(photo, "receipt.jpg"), amount: "13.80" });
    expect(reply.body).toMatchObject({
      status: "DISPUTED",
      explanation:
        'The receipt reader flagged this receipt (Printed "NOT A REAL PURCHASE"; Marked "LOCAL TEST"), so the entered SGD 13.80 needs review.',
    });
    expect(await ledger()).toMatchObject({ confirmedSpend: { amount: "0.00" } });
  });

  it("disputes a matching amount on an image that is not a purchase receipt", async () => {
    const { send, ledger } = await printReady(
      fixtureReceiptReader(receiptFixture("receipt-quotation")),
    );
    const photo = await receiptPhoto({
      notice: "QUOTATION",
      merchant: "PRINT HUB PTE LTD",
      total: "13.80",
    });
    const reply = await send({ receipt: jpegFile(photo, "quote.jpg"), amount: "13.80" });
    expect(reply.body).toMatchObject({
      status: "DISPUTED",
      explanation:
        "The receipt reader says this image is not a purchase receipt (A quotation, not a record of a payment), so the entered SGD 13.80 needs review.",
    });
    expect(await ledger()).toMatchObject({ confirmedSpend: { amount: "0.00" } });
  });

  it("disputes a receipt the reader could not read", async () => {
    const { send } = await printReady(fixtureReceiptReader(receiptFixture("receipt-unreadable")));
    const reply = await send({ receipt: await receipt(), amount: "13.80" });
    expect(reply.body).toMatchObject({
      status: "DISPUTED",
      explanation: "The receipt total could not be read, so the entered SGD 13.80 needs review.",
    });
  });

  it("leaves the amount submitted when there is no reader or the reader fails", async () => {
    const quiet = await printReady(null);
    const unread = await quiet.send({ receipt: await receipt(), amount: "13.80" });
    expect(unread.body).toMatchObject({
      status: "SUBMITTED",
      explanation: "No receipt reader is set up, so the entered SGD 13.80 waits for review.",
    });
    expect(await quiet.ledger()).toMatchObject({ confirmedSpend: { amount: "0.00" } });
    const broken = await printReady(failingReceiptReader("API_ERROR"));
    const failed = await broken.send({ receipt: await receipt(), amount: "13.80" });
    expect(failed.body).toMatchObject({ status: "SUBMITTED" });
    expect(failed.body.explanation).toContain("(API_ERROR)");
  });

  it("counts the same receipt and amount sent twice once, and refuses a second receipt", async () => {
    const reader = matching();
    const { send } = await printReady(reader);
    const photo = await receipt();
    const first = await send({ receipt: photo, amount: "13.80" });
    const again = await send({ receipt: photo, amount: "13.80" });
    expect(again).toMatchObject({ status: 200, body: first.body });
    expect(reader.calls).toHaveLength(1);
    const other = await send({ receipt: await receipt("14.20"), amount: "14.20" });
    expect(other).toMatchObject({ status: 409, body: { error: "EXPENSE_ALREADY_SUBMITTED" } });
    expect(await db.select().from(expenses)).toHaveLength(1);
  });

  it("accepts a corrected amount after a dispute", async () => {
    const { send, ledger } = await printReady(matching());
    const photo = await receipt();
    await send({ receipt: photo, amount: "12.00" });
    const corrected = await send({ receipt: photo, amount: "13.80" });
    expect(corrected).toMatchObject({ status: 201, body: { status: "CONFIRMED" } });
    expect(await ledger()).toMatchObject({ confirmedSpend: { amount: "13.80" } });
  });

  it.each([
    ["no amount", {}],
    ["a comma decimal", { amount: "13,80" }],
    ["a zero amount", { amount: "0" }],
  ])("rejects %s", async (_label, fields) => {
    const { send } = await printReady(matching());
    expect(await send({ receipt: await receipt(), ...fields })).toMatchObject({
      status: 400,
      body: { error: "VALIDATION_FAILED" },
    });
  });

  it("takes a receipt only on an accepted print run", async () => {
    const reader = matching();
    const target = createApp(testDeps({ receiptReader: reader }));
    const started = await startedCampaign();
    const { runner } = started;
    const print = taskFor(started.campaign, null).id;
    const sendTo = async (taskId: string) =>
      postForm(
        taskPath(runner.token, taskId, "expense"),
        { receipt: await receipt(), amount: "13.80" },
        target,
      );
    expect(await sendTo(print)).toMatchObject({
      status: 409,
      body: { error: "TASK_NOT_ACCEPTED" },
    });
    await finishPrint(started, "6.00");
    await runPass();
    const spotA = taskFor(await campaignNow(started.campaign.id), "A").id;
    await runnerCall("POST", taskPath(runner.token, spotA, "accept"));
    expect(await sendTo(spotA)).toMatchObject({ status: 409, body: { error: "NOT_A_PRINT_RUN" } });
  });

  it("finishes the print run once its receipt is in and says so in the timeline", async () => {
    const { campaign, runner, taskId, send, target } = await printReady(matching());
    await send({ receipt: await receipt(), amount: "13.80", merchant: "Print Hub" });
    const done = await runnerCall("POST", taskPath(runner.token, taskId, "complete"));
    expect(done).toMatchObject({
      status: 200,
      body: { status: "COMPLETED", expense: { status: "CONFIRMED" } },
    });
    const events = await callApp<TimelineEventView[]>(
      target,
      "GET",
      `/campaigns/${campaign.id}/timeline`,
    );
    const spend = events.body.filter((event) => event.type.startsWith("EXPENSE_"));
    expect(spend.map(({ actor, summary }) => [actor, summary])).toEqual([
      ["RUNNER", "Ana submitted a SGD 13.80 receipt from Print Hub"],
      [
        "DATUM_RULES",
        "Confirmed SGD 13.80 of spend: The amount read from the receipt from PRINT HUB PTE LTD matches the entered SGD 13.80.",
      ],
    ]);
    const [row] = await db.select().from(expenses).where(eq(expenses.physicalTaskId, taskId));
    expect(row?.decidedAt).toBeInstanceOf(Date);
  });
});
