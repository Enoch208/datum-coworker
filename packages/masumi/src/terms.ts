import { z } from "zod";
import { cardanoNetwork, paymentSourceType } from "./constants";
import { TerminalLifecycleError } from "./errors";
import type { MpsPayment } from "./mps/schemas";
import type { PaymentSchedule } from "./schedule";
import type { MasumiPaymentPayload } from "./sokosumi/schemas";

export const signedTermsSchema = z.object({
  paymentId: z.string(),
  blockchainIdentifier: z.string(),
  agentIdentifier: z.string(),
  sellerVkey: z.string(),
  sellerAddress: z.string(),
  inputHash: z.string(),
  payByTime: z.string(),
  submitResultTime: z.string(),
  unlockTime: z.string(),
  externalDisputeUnlockTime: z.string(),
  amounts: z.array(z.object({ amount: z.string(), unit: z.string() })),
  policyId: z.string(),
  smartContractAddress: z.string(),
});
export type SignedTerms = z.infer<typeof signedTermsSchema>;

export interface ExpectedTerms {
  readonly agentIdentifier: string;
  readonly inputHash: string;
  readonly sellerAddress: string;
  readonly amountAtomic: string;
  readonly unit: string;
  readonly schedule: PaymentSchedule;
}

const millisecondString = /^[1-9]\d*$/;
const hex56 = /^[0-9a-f]{56}$/;

export function signedTermsViolations(payment: MpsPayment, expected: ExpectedTerms): string[] {
  const funds = payment.RequestedFunds;
  const wallet = payment.SmartContractWallet;
  const source = payment.PaymentSource;
  const checks: [boolean, string][] = [
    [
      funds.length === 1 &&
        funds[0]?.amount === expected.amountAtomic &&
        funds[0].unit === expected.unit,
      `RequestedFunds must be exactly ${expected.amountAtomic} of ${expected.unit}`,
    ],
    [source.network === cardanoNetwork, "PaymentSource.network must be Preprod"],
    [source.paymentSourceType === paymentSourceType, "PaymentSource must be Web3CardanoV2"],
    [source.smartContractAddress.startsWith("addr_test1"), "contract must be a Preprod address"],
    [
      source.policyId === expected.agentIdentifier.slice(0, 56),
      "PaymentSource.policyId must be the agentIdentifier registry policy",
    ],
    [payment.agentIdentifier === expected.agentIdentifier, "agentIdentifier must be ours"],
    [payment.pricingType === "Dynamic", "pricingType must be Dynamic"],
    [payment.inputHash === expected.inputHash, "inputHash must be the hash we sent"],
    [wallet !== null && wallet.walletAddress === expected.sellerAddress, "seller must be ours"],
    [wallet !== null && hex56.test(wallet.walletVkey), "seller vkey must be 56 hex"],
    [payment.sellerReturnAddress === null, "sellerReturnAddress must be null"],
    [payment.forceLayer == null, "forceLayer must be null or absent"],
    [payment.onChainState === null, "onChainState must still be null"],
    [
      payment.NextAction.requestedAction === "WaitingForExternalAction",
      "NextAction must be WaitingForExternalAction",
    ],
    [payment.payByTime === String(expected.schedule.payByTime), "payByTime must be as requested"],
    [
      payment.submitResultTime === String(expected.schedule.submitResultTime),
      "submitResultTime must be as requested",
    ],
    [
      payment.unlockTime === String(expected.schedule.unlockTime),
      "unlockTime must be as requested",
    ],
    [
      payment.externalDisputeUnlockTime === String(expected.schedule.externalDisputeUnlockTime),
      "externalDisputeUnlockTime must be as requested",
    ],
  ];
  return checks.filter(([holds]) => !holds).map(([, rule]) => rule);
}

export function validateSignedTerms(payment: MpsPayment, expected: ExpectedTerms): SignedTerms {
  const violations = signedTermsViolations(payment, expected);
  const { SmartContractWallet: wallet, PaymentSource: source, payByTime } = payment;
  if (
    violations.length > 0 ||
    wallet === null ||
    source.policyId === null ||
    payment.agentIdentifier === null ||
    payment.inputHash === null ||
    payByTime === null
  ) {
    throw new TerminalLifecycleError(
      `Signed terms ${payment.id} were rejected before forwarding: ${violations.join("; ")}`,
    );
  }
  const times = [
    payByTime,
    payment.submitResultTime,
    payment.unlockTime,
    payment.externalDisputeUnlockTime,
  ];
  if (!times.every((time) => millisecondString.test(time))) {
    throw new TerminalLifecycleError("Signed deadlines must be canonical millisecond strings");
  }
  return {
    paymentId: payment.id,
    blockchainIdentifier: payment.blockchainIdentifier,
    agentIdentifier: payment.agentIdentifier,
    sellerVkey: wallet.walletVkey,
    sellerAddress: wallet.walletAddress,
    inputHash: payment.inputHash,
    payByTime,
    submitResultTime: payment.submitResultTime,
    unlockTime: payment.unlockTime,
    externalDisputeUnlockTime: payment.externalDisputeUnlockTime,
    amounts: payment.RequestedFunds.map(({ amount, unit }) => ({ amount, unit })),
    policyId: source.policyId,
    smartContractAddress: source.smartContractAddress,
  };
}

export function masumiPaymentPayload(
  terms: SignedTerms,
  nonce: string,
  supportedPaymentSourceIndex: number,
): MasumiPaymentPayload {
  return {
    blockchainIdentifier: terms.blockchainIdentifier,
    identifierFromPurchaser: nonce,
    agentIdentifier: terms.agentIdentifier,
    sellerVkey: terms.sellerVkey,
    inputHash: terms.inputHash,
    payByTime: terms.payByTime,
    submitResultTime: terms.submitResultTime,
    unlockTime: terms.unlockTime,
    externalDisputeUnlockTime: terms.externalDisputeUnlockTime,
    Amounts: terms.amounts,
    paymentSourceType,
    supportedPaymentSourceIndex,
    PaymentSource: {
      network: cardanoNetwork,
      policyId: terms.policyId,
      smartContractAddress: terms.smartContractAddress,
    },
  };
}
