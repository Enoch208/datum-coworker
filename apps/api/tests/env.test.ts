import { describe, expect, it } from "vitest";
import { loadEnv, rateSettings } from "../src/env";

const base = {
  DATABASE_URL: "postgres://datum:datum@localhost:54330/datum",
  APP_BASE_URL: "https://usedatum.xyz/",
};

describe("loadEnv", () => {
  it("boots without an AI key or rates and keeps assets in ./.assets", () => {
    const env = loadEnv({ ...base, ANTHROPIC_API_KEY: "", ASSET_DIR: "" });
    expect(env).toMatchObject({ APP_BASE_URL: "https://usedatum.xyz", ASSET_DIR: "./.assets" });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(rateSettings(env)).toEqual({
      configured: false,
      missing: ["DATUM_PRINT_COST_PER_COPY", "DATUM_PLACEMENT_COST_PER_SPOT"],
    });
  });

  it("reads the cost rates as exact cents", () => {
    const env = loadEnv({
      ...base,
      DATUM_PRINT_COST_PER_COPY: "0.85",
      DATUM_PLACEMENT_COST_PER_SPOT: "6",
    });
    expect(rateSettings(env)).toEqual({
      configured: true,
      rates: {
        printCostPerCopy: { amountMinor: 85, currency: "SGD" },
        placementCostPerSpot: { amountMinor: 600, currency: "SGD" },
      },
    });
  });

  it("names the one rate that is missing", () => {
    const env = loadEnv({ ...base, DATUM_PRINT_COST_PER_COPY: "0.85" });
    expect(rateSettings(env)).toEqual({
      configured: false,
      missing: ["DATUM_PLACEMENT_COST_PER_SPOT"],
    });
  });

  it("accepts an operator key of at least 32 characters and refuses a shorter one", () => {
    expect(loadEnv({ ...base, OPERATOR_KEY: "k".repeat(32) }).OPERATOR_KEY).toBe("k".repeat(32));
    expect(loadEnv({ ...base, OPERATOR_KEY: "" }).OPERATOR_KEY).toBeUndefined();
    expect(() => loadEnv({ ...base, OPERATOR_KEY: "k".repeat(31) })).toThrow();
  });

  it("refuses a rate that is not a decimal amount", () => {
    expect(() => loadEnv({ ...base, DATUM_PRINT_COST_PER_COPY: "1,50" })).toThrow();
  });
});
