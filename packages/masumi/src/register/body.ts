import { cardanoNetwork, paymentSourceType } from "../constants";
import type { RegistrationBody, ScopedKeyBody } from "../mps/admin";
import { runtimeKeyProblems } from "../mps/key-scope";
import type { MpsApiKey, MpsRegistryEntry } from "../mps/schemas";

export const datumRegistration = {
  name: "Datum",
  description:
    "AI Coworker for small physical marketing campaigns: it commissions placements, checks one evidence photo per spot and repairs misses until every approved spot is live.",
  capability: { name: "datum-campaign-coworker", version: "0.1.0" },
  author: "Datum",
  tags: ["marketing", "physical-campaigns", "coworker"],
} as const;

export function registrationBody(
  sellingWalletVkey: string,
  smartContractAddress: string,
  apiBaseUrl: string,
): RegistrationBody {
  return {
    network: cardanoNetwork,
    type: "Standard",
    sellingWalletVkey,
    supportedPaymentSources: [
      {
        chain: "Cardano",
        network: cardanoNetwork,
        paymentSourceType,
        address: smartContractAddress,
        pricing: { pricingType: "Dynamic" },
      },
    ],
    name: datumRegistration.name,
    description: datumRegistration.description,
    Capability: datumRegistration.capability,
    Author: { name: datumRegistration.author },
    Tags: datumRegistration.tags,
    ExampleOutputs: [],
    apiBaseUrl,
  };
}

export function scopedKeyBody(sellingWalletId: string): ScopedKeyBody {
  return {
    usageLimited: "false",
    UsageCredits: [],
    NetworkLimit: [cardanoNetwork],
    ChainIdLimit: [],
    canRead: true,
    canPay: true,
    canAdmin: false,
    walletScopeEnabled: true,
    WalletScopeHotWalletIds: [sellingWalletId],
    x402WalletScopeEnabled: true,
    X402WalletScopeEvmWalletIds: [],
  };
}

export function scopedKeyProblems(key: MpsApiKey, sellingWalletId: string): string[] {
  const revealed = !key.token.startsWith("*****");
  return [
    ...runtimeKeyProblems(key, sellingWalletId),
    ...(revealed ? [] : ["the token was not revealed"]),
  ];
}

export function supportedSourceIndex(
  entry: MpsRegistryEntry,
  smartContractAddress: string,
): number {
  return (entry.supportedPaymentSources ?? []).findIndex(
    (source) =>
      source.network === cardanoNetwork &&
      source.paymentSourceType === paymentSourceType &&
      source.address === smartContractAddress,
  );
}
