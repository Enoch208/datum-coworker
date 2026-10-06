import { describe, expect, it } from "vitest";
import { mpsApiKeySchema, mpsRegistryEntrySchema } from "../src/mps/schemas";
import {
  registrationBody,
  scopedKeyBody,
  scopedKeyProblems,
  supportedSourceIndex,
} from "../src/register/body";
import { recordedApiKey } from "./fixtures/api-key";
import { recordedSeller } from "./fixtures/mps-payment";

describe("one-time registration", () => {
  it("registers a Standard agent with Dynamic pricing and nothing else on the V2 source", () => {
    const body = registrationBody(
      recordedSeller.sellerVkey,
      recordedSeller.smartContractAddress,
      "http://127.0.0.1:8790",
    );
    expect(body).toMatchObject({
      network: "Preprod",
      type: "Standard",
      sellingWalletVkey: recordedSeller.sellerVkey,
      supportedPaymentSources: [
        {
          chain: "Cardano",
          network: "Preprod",
          paymentSourceType: "Web3CardanoV2",
          address: recordedSeller.smartContractAddress,
          pricing: { pricingType: "Dynamic" },
        },
      ],
      ExampleOutputs: [],
      apiBaseUrl: "http://127.0.0.1:8790",
    });
    expect(Object.keys(body.supportedPaymentSources[0].pricing)).toEqual(["pricingType"]);
    expect(body).not.toHaveProperty("AgentPricing");
    expect(body.Tags.length).toBeGreaterThan(0);
    expect(body.description.length).toBeLessThanOrEqual(250);
  });

  it("finds the source index from the recorded registry entry", () => {
    const entry = mpsRegistryEntrySchema.parse({
      error: null,
      id: "cmuw17k0a0002b9vbkwoi9qxe",
      name: "Datum",
      state: "RegistrationConfirmed",
      apiBaseUrl: "http://127.0.0.1:8790",
      agentIdentifier: recordedSeller.agentIdentifier,
      supportedPaymentSources: [
        {
          chain: "Cardano",
          network: "Preprod",
          paymentSourceType: "Web3CardanoV2",
          address: recordedSeller.smartContractAddress,
          pricing: { pricingType: "Dynamic" },
        },
      ],
      SmartContractWallet: {
        walletVkey: recordedSeller.sellerVkey,
        walletAddress: recordedSeller.sellerAddress,
      },
      CurrentTransaction: {
        txHash: "4391dc1b6b192b63b7d9ac74cc5bba16acde5872d5f5384b431176b922b9a09c",
        status: "Confirmed",
        confirmations: 0,
        fees: "270578",
        blockHeight: 5258853,
        blockTime: 1791252421,
      },
    });
    expect(supportedSourceIndex(entry, recordedSeller.smartContractAddress)).toBe(0);
    expect(supportedSourceIndex(entry, "addr_test1wother")).toBe(-1);
  });
});

describe("scoped runtime key", () => {
  const requested = scopedKeyBody(recordedSeller.walletId);
  it("asks for ReadAndPay on Preprod, scoped to the selling wallet", () => {
    expect(requested).toMatchObject({
      usageLimited: "false",
      NetworkLimit: ["Preprod"],
      canRead: true,
      canPay: true,
      canAdmin: false,
      walletScopeEnabled: true,
      WalletScopeHotWalletIds: [recordedSeller.walletId],
    });
  });

  it("accepts the recorded key shape", () => {
    expect(
      scopedKeyProblems(mpsApiKeySchema.parse(recordedApiKey), recordedSeller.walletId),
    ).toEqual([]);
  });

  it.each([
    ["an admin key", { canAdmin: true }],
    ["a usage limited key", { usageLimited: true }],
    ["a masked token", { token: "*****oken" }],
    ["a key without wallet scope", { walletScopeEnabled: false }],
    ["a key scoped to no wallet", { WalletScopes: [] }],
    ["a revoked key", { status: "Revoked" }],
    ["a Mainnet key", { NetworkLimit: ["Mainnet", "Preprod"] }],
  ])("flags %s", (_label, change) => {
    const key = mpsApiKeySchema.parse({ ...recordedApiKey, ...change });
    expect(scopedKeyProblems(key, recordedSeller.walletId)).toHaveLength(1);
  });
});
