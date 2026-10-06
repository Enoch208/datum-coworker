import { describe, expect, it } from "vitest";
import { costRates, loadCoworkerEnv } from "../src/env";

const complete = {
  SOKOSUMI_COWORKER_API_KEY: "coworker_test_runtime_key",
  MASUMI_PAYMENT_API_URL: "http://127.0.0.1:3012/api/v1/",
  MASUMI_PAYMENT_API_KEY: "scoped-runtime-token-0123",
  MASUMI_AGENT_IDENTIFIER: "67ab0c92c4ac1610895a1c965ee50aba41a8f1513b15240723b3bd0b1046ff",
  MASUMI_SUPPORTED_PAYMENT_SOURCE_INDEX: "0",
  MASUMI_SELLER_ADDRESS: "addr_test1qpgqh5zs3x96srsu6697d2vee6ge7pe9yxz0p2rlzeagry",
  MASUMI_SELLING_WALLET_ID: "cmuw0yy7w0009zcvbzcjwnn33",
  BLOCKFROST_API_KEY_PREPROD: "preprodTestProject",
  DATABASE_URL: "postgres://datum:datum@localhost:54330/datum",
  APP_BASE_URL: "https://usedatum.xyz/",
  ASSET_DIR: "/srv/datum/app/apps/api/.assets",
  DATUM_PRINT_COST_PER_COPY: "1.00",
  DATUM_PLACEMENT_COST_PER_SPOT: "5.00",
};

describe("the Coworker's environment", () => {
  it("reads every setting it needs, with Preprod Core and a private journal by default", () => {
    const env = loadCoworkerEnv(complete);
    expect(env).toMatchObject({
      SOKOSUMI_API_URL: "https://api.preprod.sokosumi.com",
      MASUMI_PAYMENT_API_URL: "http://127.0.0.1:3012/api/v1",
      MASUMI_SUPPORTED_PAYMENT_SOURCE_INDEX: 0,
      APP_BASE_URL: "https://usedatum.xyz",
    });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.COWORKER_JOURNAL_DIR).toMatch(/\.datum\/coworker-journal$/);
    expect(costRates(env)).toEqual({
      printCostPerCopy: { amountMinor: 100, currency: "SGD" },
      placementCostPerSpot: { amountMinor: 500, currency: "SGD" },
    });
  });

  it("names every missing or wrong setting without echoing secret values", () => {
    const attempt = () =>
      loadCoworkerEnv({
        ...complete,
        SOKOSUMI_COWORKER_API_KEY: "sk_live_wrong_kind_of_key",
        ASSET_DIR: "relative/assets",
        DATUM_PLACEMENT_COST_PER_SPOT: "",
      });
    expect(attempt).toThrow(/SOKOSUMI_COWORKER_API_KEY: must be a coworker_ runtime key/);
    expect(attempt).toThrow(/ASSET_DIR: must be the API's absolute card directory/);
    expect(attempt).toThrow(/DATUM_PLACEMENT_COST_PER_SPOT/);
    expect(attempt).not.toThrow(/sk_live_wrong_kind_of_key/);
  });
});
