import { describe, expect, it } from "vitest";
import { call, resetDatabaseBetweenTests } from "./support";

resetDatabaseBetweenTests();

describe("health", () => {
  it("reports ok once the database answers", async () => {
    expect(await call("GET", "/health")).toEqual({ status: 200, body: { status: "ok" } });
  });

  it("answers unknown routes with a typed 404", async () => {
    expect(await call("GET", "/nope")).toEqual({
      status: 404,
      body: { error: "NOT_FOUND", message: "No route for GET /nope" },
    });
  });
});
