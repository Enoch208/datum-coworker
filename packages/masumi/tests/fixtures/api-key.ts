import { recordedSeller } from "./mps-payment";

export const recordedApiKey = {
  id: "cmuw15kk30000b9vbuwdgob1d",
  token: "runtime-token-revealed-once",
  permission: "ReadAndPay",
  canRead: true,
  canPay: true,
  canAdmin: false,
  usageLimited: false,
  NetworkLimit: ["Preprod"],
  ChainIdLimit: ["cardano:preprod"],
  RemainingUsageCredits: [],
  status: "Active",
  walletScopeEnabled: true,
  WalletScopes: [{ hotWalletId: recordedSeller.walletId }],
  x402WalletScopeEnabled: true,
  X402WalletScopes: [],
};

export const maskedApiKeyStatus = { ...recordedApiKey, token: "*****once" };
