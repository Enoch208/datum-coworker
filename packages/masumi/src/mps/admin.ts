import { cardanoNetwork, paymentSourceType } from "../constants";
import { createMpsTransport, type MpsConnection } from "./transport";
import {
  mpsApiKeySchema,
  mpsHealthSchema,
  mpsPaymentSourceListSchema,
  mpsRegistryEntrySchema,
  mpsRegistryListSchema,
  mpsSellingWalletSchema,
  type MpsApiKey,
  type MpsPaymentSource,
  type MpsRegistryEntry,
  type MpsSellingWallet,
} from "./schemas";

export interface RegistrationBody {
  readonly network: typeof cardanoNetwork;
  readonly type: "Standard";
  readonly sellingWalletVkey: string;
  readonly supportedPaymentSources: readonly [
    {
      readonly chain: "Cardano";
      readonly network: typeof cardanoNetwork;
      readonly paymentSourceType: typeof paymentSourceType;
      readonly address: string;
      readonly pricing: { readonly pricingType: "Dynamic" };
    },
  ];
  readonly name: string;
  readonly description: string;
  readonly Capability: { readonly name: string; readonly version: string };
  readonly Author: { readonly name: string };
  readonly Tags: readonly string[];
  readonly ExampleOutputs: readonly [];
  readonly apiBaseUrl: string;
}

export interface ScopedKeyBody {
  readonly usageLimited: "false";
  readonly UsageCredits: readonly [];
  readonly NetworkLimit: readonly [typeof cardanoNetwork];
  readonly ChainIdLimit: readonly [];
  readonly canRead: true;
  readonly canPay: true;
  readonly canAdmin: false;
  readonly walletScopeEnabled: true;
  readonly WalletScopeHotWalletIds: readonly [string];
  readonly x402WalletScopeEnabled: true;
  readonly X402WalletScopeEvmWalletIds: readonly [];
}

export interface MpsAdminClient {
  health(): Promise<{ status: string }>;
  sellingWallet(walletId: string): Promise<MpsSellingWallet>;
  paymentSources(): Promise<MpsPaymentSource[]>;
  register(body: RegistrationBody): Promise<MpsRegistryEntry>;
  registrations(): Promise<MpsRegistryEntry[]>;
  createApiKey(body: ScopedKeyBody): Promise<MpsApiKey>;
}

export function createMpsAdminClient(connection: MpsConnection): MpsAdminClient {
  const transport = createMpsTransport(connection);
  return {
    health: () => transport.get("/health", mpsHealthSchema),
    sellingWallet: (walletId) =>
      transport.get(
        `/wallet?walletType=Selling&id=${encodeURIComponent(walletId)}`,
        mpsSellingWalletSchema,
      ),
    paymentSources: async () =>
      (await transport.get("/payment-source?take=100", mpsPaymentSourceListSchema)).PaymentSources,
    register: (body) => transport.post("/registry", body, mpsRegistryEntrySchema),
    registrations: async () =>
      (
        await transport.get(
          `/registry?network=${cardanoNetwork}&filterPaymentSourceType=${paymentSourceType}&limit=100`,
          mpsRegistryListSchema,
        )
      ).Assets,
    createApiKey: (body) => transport.post("/api-key", body, mpsApiKeySchema),
  };
}
