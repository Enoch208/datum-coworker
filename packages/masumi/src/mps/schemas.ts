import { z } from "zod";

export const onChainStates = [
  "FundsLocked",
  "FundsOrDatumInvalid",
  "ResultSubmitted",
  "RefundRequested",
  "Disputed",
  "WithdrawAuthorized",
  "RefundAuthorized",
  "Withdrawn",
  "RefundWithdrawn",
  "DisputedWithdrawn",
] as const;
export type OnChainState = (typeof onChainStates)[number];

export const paymentActions = [
  "None",
  "Ignore",
  "WaitingForManualAction",
  "WaitingForExternalAction",
  "SubmitResultRequested",
  "SubmitResultInitiated",
  "WithdrawRequested",
  "WithdrawInitiated",
  "AuthorizeRefundRequested",
  "AuthorizeRefundInitiated",
] as const;

const transactionStatuses = [
  "Pending",
  "Confirmed",
  "FailedViaTimeout",
  "FailedViaManualReset",
  "RolledBack",
] as const;

const registrationStates = [
  "RegistrationRequested",
  "RegistrationInitiated",
  "RegistrationConfirmed",
  "RegistrationFailed",
  "DeregistrationRequested",
  "DeregistrationInitiated",
  "DeregistrationConfirmed",
  "DeregistrationFailed",
  "UpdateRequested",
  "UpdateInitiated",
  "UpdateConfirmed",
  "UpdateFailed",
] as const;

const networks = ["Preprod", "Mainnet"] as const;
const paymentSourceTypes = ["Web3CardanoV1", "Web3CardanoV2"] as const;
const pricingTypes = ["Fixed", "Free", "Dynamic"] as const;

const assetAmount = z.object({ amount: z.string(), unit: z.string() });

const paymentTransaction = z.object({
  txHash: z.string().nullable(),
  status: z.enum(transactionStatuses),
  previousOnChainState: z.enum(onChainStates).nullable(),
  newOnChainState: z.enum(onChainStates).nullable(),
  confirmations: z.number().nullable(),
  blockHeight: z.number().nullable(),
});
export type PaymentTransaction = z.infer<typeof paymentTransaction>;

export const mpsPaymentSchema = z.object({
  id: z.string(),
  blockchainIdentifier: z.string().min(1),
  agentIdentifier: z.string().nullable(),
  pricingType: z.enum(pricingTypes),
  payByTime: z.string().nullable(),
  submitResultTime: z.string(),
  unlockTime: z.string(),
  externalDisputeUnlockTime: z.string(),
  sellerReturnAddress: z.string().nullable(),
  inputHash: z.string().nullable(),
  resultHash: z.string().nullable(),
  onChainState: z.enum(onChainStates).nullable(),
  forceLayer: z.enum(["L1", "Hydra"]).nullable().optional(),
  NextAction: z.object({
    requestedAction: z.enum(paymentActions),
    errorType: z.enum(["NetworkError", "Unknown"]).nullable(),
    errorNote: z.string().nullable(),
    resultHash: z.string().nullable(),
  }),
  CurrentTransaction: paymentTransaction.nullable(),
  TransactionHistory: z.array(paymentTransaction).nullable().optional(),
  RequestedFunds: z.array(assetAmount),
  WithdrawnForSeller: z.array(assetAmount),
  PaymentSource: z.object({
    id: z.string(),
    network: z.enum(networks),
    paymentSourceType: z.enum(paymentSourceTypes),
    smartContractAddress: z.string(),
    policyId: z.string().nullable(),
  }),
  SmartContractWallet: z
    .object({ id: z.string(), walletVkey: z.string(), walletAddress: z.string() })
    .nullable(),
});
export type MpsPayment = z.infer<typeof mpsPaymentSchema>;

export const mpsRegistryEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.enum(registrationStates),
  error: z.string().nullable(),
  apiBaseUrl: z.string().nullable(),
  agentIdentifier: z.string().nullable(),
  supportedPaymentSources: z
    .array(
      z.object({
        chain: z.string(),
        network: z.string(),
        paymentSourceType: z.string().nullable().optional(),
        address: z.string().optional(),
        pricing: z.object({ pricingType: z.enum(pricingTypes) }),
      }),
    )
    .nullable(),
  SmartContractWallet: z.object({ walletVkey: z.string(), walletAddress: z.string() }),
  CurrentTransaction: z
    .object({ txHash: z.string().nullable(), status: z.enum(transactionStatuses) })
    .nullable(),
});
export type MpsRegistryEntry = z.infer<typeof mpsRegistryEntrySchema>;

export const mpsRegistryListSchema = z.object({ Assets: z.array(mpsRegistryEntrySchema) });

export const mpsApiKeySchema = z.object({
  id: z.string(),
  token: z.string(),
  permission: z.enum(["Read", "ReadAndPay", "Admin"]),
  canRead: z.boolean(),
  canPay: z.boolean(),
  canAdmin: z.boolean(),
  usageLimited: z.boolean(),
  NetworkLimit: z.array(z.enum(networks)),
  status: z.enum(["Active", "Revoked"]),
  walletScopeEnabled: z.boolean(),
  WalletScopes: z.array(z.object({ hotWalletId: z.string() })),
});
export type MpsApiKey = z.infer<typeof mpsApiKeySchema>;

export const mpsHealthSchema = z.object({ status: z.string() });

export const mpsSellingWalletSchema = z.object({
  walletVkey: z.string(),
  walletAddress: z.string(),
  collectionAddress: z.string().nullable(),
});
export type MpsSellingWallet = z.infer<typeof mpsSellingWalletSchema>;

export const mpsPaymentSourceListSchema = z.object({
  PaymentSources: z.array(
    z.object({
      id: z.string(),
      network: z.enum(networks),
      paymentSourceType: z.enum(paymentSourceTypes),
      policyId: z.string().nullable(),
      smartContractAddress: z.string(),
    }),
  ),
});
export type MpsPaymentSource = z.infer<typeof mpsPaymentSourceListSchema>["PaymentSources"][number];

export const mpsErrorBodySchema = z.object({
  status: z.literal("error"),
  error: z.object({ message: z.string() }),
});
