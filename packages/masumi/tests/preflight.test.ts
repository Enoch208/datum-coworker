import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env";
import { gate0EnvSchema } from "../src/gate0/env";
import { preflight } from "../src/gate0/preflight";
import type { MpsClient } from "../src/mps/client";
import { mpsApiKeySchema } from "../src/mps/schemas";
import type { CoreClient } from "../src/sokosumi/client";
import { maskedApiKeyStatus } from "./fixtures/api-key";
import { recordedSeller } from "./fixtures/mps-payment";

const core: Pick<CoreClient, "me"> = {
  me: () => Promise.resolve({ id: "cow_datum", archivedAt: null, capabilities: ["chat", "tasks"] }),
};

function mpsReporting(change: Record<string, unknown>): Pick<MpsClient, "health" | "apiKeyStatus"> {
  return {
    health: () => Promise.resolve({ status: "ok" }),
    apiKeyStatus: () =>
      Promise.resolve(mpsApiKeySchema.parse({ ...maskedApiKeyStatus, ...change })),
  };
}

const check = (change: Record<string, unknown>) =>
  preflight(core, mpsReporting(change), recordedSeller.walletId, () => undefined);

describe("Gate 0 preflight of the runtime MPS key", () => {
  it("accepts the scoped key as /api-key-status reports it, with its token masked", async () => {
    await expect(check({})).resolves.toBe("cow_datum");
  });

  it.each([
    ["a revoked key", { status: "Revoked" }, "must be Active"],
    ["a key that cannot read", { canRead: false }, "must be able to read"],
    ["a key that cannot pay", { canPay: false }, "must be able to pay"],
    ["an admin key", { canAdmin: true }, "must not be an admin key"],
    ["a usage limited key", { usageLimited: true }, "must not be usage limited"],
    ["a key that also reaches Mainnet", { NetworkLimit: ["Preprod", "Mainnet"] }, "Preprod only"],
    ["a Mainnet key", { NetworkLimit: ["Mainnet"] }, "Preprod only"],
    ["a key without a network limit", { NetworkLimit: [] }, "Preprod only"],
    ["a key without wallet scope", { walletScopeEnabled: false }, "wallet scope enabled"],
    ["a key scoped to no wallet", { WalletScopes: [] }, "selling wallet only"],
    [
      "a key scoped to another wallet",
      { WalletScopes: [{ hotWalletId: "cmuw0yy7w0009zcvbother000" }] },
      "selling wallet only",
    ],
    [
      "a key scoped to the selling wallet and another",
      {
        WalletScopes: [
          { hotWalletId: recordedSeller.walletId },
          { hotWalletId: "cmuw0yy7w0009zcvbother000" },
        ],
      },
      "selling wallet only",
    ],
  ])("refuses %s", async (_label, change: Record<string, unknown>, reason) => {
    const failure = check(change);
    await expect(failure).rejects.toThrow("MASUMI_PAYMENT_API_KEY");
    await expect(failure).rejects.toThrow(reason);
  });

  it("refuses an unhealthy payment service before reading the key", async () => {
    const mps = { ...mpsReporting({}), health: () => Promise.resolve({ status: "degraded" }) };
    await expect(preflight(core, mps, recordedSeller.walletId, () => undefined)).rejects.toThrow(
      "health is degraded",
    );
  });
});

describe("Gate 0 environment", () => {
  const environment = {
    SOKOSUMI_COWORKER_API_KEY: "coworker_test_runtime_key",
    MASUMI_PAYMENT_API_URL: "http://127.0.0.1:3012/api/v1",
    MASUMI_PAYMENT_API_KEY: "scoped-runtime-token",
    MASUMI_AGENT_IDENTIFIER: recordedSeller.agentIdentifier,
    MASUMI_SUPPORTED_PAYMENT_SOURCE_INDEX: "0",
    MASUMI_SELLER_ADDRESS: recordedSeller.sellerAddress,
    BLOCKFROST_API_KEY_PREPROD: "preprodTestProject",
    DATABASE_URL: "postgres://datum:datum@localhost:54330/datum",
  };

  it("requires the selling wallet the runtime key must be scoped to", () => {
    expect(() => loadEnv(gate0EnvSchema, environment)).toThrow("MASUMI_SELLING_WALLET_ID");
    expect(
      loadEnv(gate0EnvSchema, {
        ...environment,
        MASUMI_SELLING_WALLET_ID: recordedSeller.walletId,
      }),
    ).toMatchObject({ MASUMI_SELLING_WALLET_ID: recordedSeller.walletId });
  });
});
