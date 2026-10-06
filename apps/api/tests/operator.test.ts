import { createHash } from "node:crypto";
import type { ApiError, OperatorRunnerView } from "@datum/core";
import { runners } from "@datum/db";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
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
