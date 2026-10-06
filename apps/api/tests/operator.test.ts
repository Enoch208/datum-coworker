import { createHash } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { ApiError, OperatorRunnerView } from "@datum/core";
import { physicalTasks, runners } from "@datum/db";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { taskFor } from "./runners/campaign";
import { printedCampaign } from "./runners/print";
import { runnerCall, taskPath } from "./runners/calls";
import { asOperator, enrollTestRunner, inFuture } from "./runners/enroll";
import { db, resetDatabaseBetweenTests, testDeps } from "./support";

resetDatabaseBetweenTests();

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

describe("POST /operator/runners", () => {
  it("returns the inbox link once and stores only the token's hash", async () => {
    const { view, token } = await enrollTestRunner("Ana Lim");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(view.runner).toMatchObject({ name: "Ana Lim", active: true });
    const [row] = await db.select().from(runners);
    expect(row?.inboxTokenHash).toBe(sha256(token));
    expect(JSON.stringify(row)).not.toContain(token);
    const listed = await asOperator<OperatorRunnerView[]>("GET", "/operator/runners");
    expect(listed.body).toEqual([view.runner]);
    expect(JSON.stringify(listed.body)).not.toContain(token);
  });

  it("gives every runner a different link", async () => {
    const first = await enrollTestRunner("Ana");
    const second = await enrollTestRunner("Ben");
    expect(first.token).not.toBe(second.token);
  });

  it.each([
    ["a blank name", { name: "  ", expiresAt: inFuture() }],
    ["an expiry in the past", { name: "Ana", expiresAt: inFuture(-1_000) }],
    ["an expiry without a timezone", { name: "Ana", expiresAt: "2030-01-01T00:00:00" }],
    ["an extra field", { name: "Ana", expiresAt: inFuture(), token: "mine" }],
  ])("rejects %s", async (_label, body) => {
    const reply = await asOperator<ApiError>("POST", "/operator/runners", body);
    expect(reply).toMatchObject({ status: 400, body: { error: "VALIDATION_FAILED" } });
    expect(await db.select().from(runners)).toEqual([]);
  });
});

const deactivate = (runnerId: string, key?: string | null) =>
  asOperator<OperatorRunnerView>(
    "POST",
    `/operator/runners/${runnerId}/deactivate`,
    undefined,
    key,
  );

const assignedTasks = (runnerId: string) =>
  db
    .select({ id: physicalTasks.id, status: physicalTasks.status })
    .from(physicalTasks)
    .where(eq(physicalTasks.runnerId, runnerId))
    .orderBy(asc(physicalTasks.id));

describe("POST /operator/runners/:id/deactivate", () => {
  it("closes the runner's link at once and leaves its assigned tasks in place", async () => {
    const { campaign, runner } = await printedCampaign();
    const runnerId = runner.view.runner.id;
    const spotA = taskFor(campaign, "A").id;
    await runnerCall("POST", taskPath(runner.token, spotA, "accept"));
    const before = await assignedTasks(runnerId);
    expect(before.length).toBeGreaterThan(0);

    const reply = await deactivate(runnerId);
    expect(reply).toMatchObject({
      status: 200,
      body: { ...runner.view.runner, active: false },
    });

    expect(await runnerCall("GET", `/runner/${runner.token}`)).toMatchObject({
      status: 404,
      body: { error: "NOT_FOUND" },
    });
    expect(await runnerCall("POST", taskPath(runner.token, spotA, "complete"))).toMatchObject({
      status: 404,
      body: { error: "NOT_FOUND" },
    });
    expect(await assignedTasks(runnerId)).toEqual(before);
    const listed = await asOperator<OperatorRunnerView[]>("GET", "/operator/runners");
    expect(listed.body).toEqual([reply.body]);
  });

  it("answers a repeat with the same inactive runner", async () => {
    const { view } = await enrollTestRunner("Ana");
    const first = await deactivate(view.runner.id);
    const again = await deactivate(view.runner.id);
    expect(again).toEqual(first);
    expect(again.body.active).toBe(false);
  });

  it("leaves every other runner's link working", async () => {
    const ana = await enrollTestRunner("Ana");
    const ben = await enrollTestRunner("Ben");
    await deactivate(ana.view.runner.id);
    expect(await runnerCall("GET", `/runner/${ben.token}`)).toMatchObject({ status: 200 });
  });

  it.each([
    ["an unknown runner", "rnr_aaaaaaaaaaaaaaaa"],
    ["a malformed id", "not-a-runner"],
  ])("answers %s with 404", async (_label, runnerId) => {
    const reply = await asOperator<ApiError>("POST", `/operator/runners/${runnerId}/deactivate`);
    expect(reply).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
  });

  it("needs the operator key", async () => {
    const { view, token } = await enrollTestRunner("Ana");
    expect(await deactivate(view.runner.id, null)).toMatchObject({
      status: 401,
      body: { error: "UNAUTHORIZED" },
    });
    expect(await runnerCall("GET", `/runner/${token}`)).toMatchObject({ status: 200 });
  });
});

describe("operator authentication", () => {
  it.each([
    ["no key", null],
    ["a wrong key", "operator-key-for-tests-0123456789abcdeX"],
    ["a short key", "x"],
  ])("refuses %s", async (_label, key) => {
    const reply = await asOperator<ApiError>("GET", "/operator/runners", undefined, key);
    expect(reply).toMatchObject({ status: 401, body: { error: "UNAUTHORIZED" } });
  });

  it("is switched off when the server has no operator key", async () => {
    const closed = createApp(testDeps({ operatorKey: null }));
    const reply = await asOperator<ApiError>("GET", "/operator/runners", undefined, "x", closed);
    expect(reply).toMatchObject({ status: 503, body: { error: "OPERATOR_DISABLED" } });
  });
});
