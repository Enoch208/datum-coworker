import { cardanoNetwork, paymentSourceType } from "../constants";
import type { RegistrationBody, ScopedKeyBody } from "../mps/admin";
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
  const checks: [boolean, string][] = [
    [key.canRead && key.canPay && !key.canAdmin, "key must be ReadAndPay without admin"],
    [!key.usageLimited, "key must not be usage limited (PATCH it with usageLimited:false)"],
    [
      key.NetworkLimit.length === 1 && key.NetworkLimit[0] === cardanoNetwork,
      "key must be Preprod only",
    ],
    [
      key.walletScopeEnabled &&
        key.WalletScopes.length === 1 &&
        key.WalletScopes[0]?.hotWalletId === sellingWalletId,
      "key must be scoped to the selling wallet",
    ],
    [!key.token.startsWith("*****"), "the token was not revealed"],
  ];
  return checks.filter(([holds]) => !holds).map(([, problem]) => problem);
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
