import { describe, expect, it } from "vitest";
import { loadWorkerEnv } from "../src/env";

const base = {
  DATABASE_URL: "postgres://datum:datum@localhost:54330/datum",
  APP_BASE_URL: "https://api.usedatum.xyz/",
  DATUM_PRINT_COST_PER_COPY: "1.50",
  DATUM_PLACEMENT_COST_PER_SPOT: "10.00",
};

describe("loadWorkerEnv", () => {
  it("reads the database, the public base URL and the agreed rates in minor units", () => {
    expect(loadWorkerEnv(base)).toEqual({
      databaseUrl: base.DATABASE_URL,
      appBaseUrl: "https://api.usedatum.xyz",
      anthropicApiKey: null,
      rates: {
        printCostPerCopy: { amountMinor: 150, currency: "SGD" },
        placementCostPerSpot: { amountMinor: 1_000, currency: "SGD" },
      },
    });
  });

  it("keeps the planner key when one is set", () => {
    expect(loadWorkerEnv({ ...base, ANTHROPIC_API_KEY: " key " }).anthropicApiKey).toBe("key");
  });

  it("refuses to start without the agreed rates, because recoveries must be priced", () => {
    expect(() => loadWorkerEnv({ ...base, DATUM_PLACEMENT_COST_PER_SPOT: "" })).toThrow();
    expect(() => loadWorkerEnv({ ...base, DATUM_PRINT_COST_PER_COPY: "1.234" })).toThrow();
  });

  it("refuses a database URL that is not Postgres", () => {
    expect(() => loadWorkerEnv({ ...base, DATABASE_URL: "mysql://localhost/datum" })).toThrow();
  });
});
