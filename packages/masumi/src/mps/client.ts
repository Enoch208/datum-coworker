import { z } from "zod";
import { cardanoNetwork } from "../constants";
import { createMpsTransport, type MpsConnection } from "./transport";
import {
  mpsApiKeySchema,
  mpsHealthSchema,
  mpsPaymentSchema,
  type MpsApiKey,
  type MpsPayment,
} from "./schemas";

export interface CreatePaymentBody {
  readonly network: typeof cardanoNetwork;
  readonly agentIdentifier: string;
  readonly paymentSourceType: "Web3CardanoV2";
  readonly supportedPaymentSourceIndex: number;
  readonly inputHash: string;
  readonly identifierFromPurchaser: string;
  readonly RequestedFunds: readonly { readonly amount: string; readonly unit: string }[];
  readonly payByTime: string;
  readonly submitResultTime: string;
  readonly unlockTime: string;
  readonly externalDisputeUnlockTime: string;
  readonly metadata: string;
}

export interface PaymentNode {
  createPayment(body: CreatePaymentBody): Promise<MpsPayment>;
  resolvePayment(blockchainIdentifier: string): Promise<MpsPayment>;
  submitResult(blockchainIdentifier: string, resultHash: string): Promise<MpsPayment>;
}

export interface MpsClient extends PaymentNode {
  health(): Promise<z.output<typeof mpsHealthSchema>>;
  apiKeyStatus(): Promise<MpsApiKey>;
}

export function createMpsClient(connection: MpsConnection): MpsClient {
  const transport = createMpsTransport(connection);
  return {
    health: () => transport.get("/health", mpsHealthSchema),
    apiKeyStatus: () => transport.get("/api-key-status", mpsApiKeySchema),
    createPayment: (body) => transport.post("/payment", body, mpsPaymentSchema),
    resolvePayment: (blockchainIdentifier) =>
      transport.post(
        "/payment/resolve-blockchain-identifier",
        { network: cardanoNetwork, blockchainIdentifier, includeHistory: "true" },
        mpsPaymentSchema,
      ),
    submitResult: (blockchainIdentifier, resultHash) =>
      transport.post(
        "/payment/submit-result",
        { network: cardanoNetwork, blockchainIdentifier, submitResultHash: resultHash },
        mpsPaymentSchema,
      ),
  };
}
