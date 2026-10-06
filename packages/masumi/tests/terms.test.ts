import { describe, expect, it } from "vitest";
import { gate0AmountAtomic, tusdmUnit } from "../src/constants";
import { TerminalLifecycleError } from "../src/errors";
import { mpsPaymentSchema } from "../src/mps/schemas";
import { buildSchedule } from "../src/schedule";
import { masumiPaymentPayload, validateSignedTerms, type ExpectedTerms } from "../src/terms";
import { paymentJson, recordedSeller } from "./fixtures/mps-payment";

const schedule = buildSchedule(Date.parse("2026-10-06T02:21:58.062Z"));
const inputHash = "8cb9b36f8aac9db1e805813979cba5ae31114571ddc2485686b5e403fa5213a8";
const blockchainIdentifier = "00e04c0860a60c61066056281180462d0b120001";

const expected: ExpectedTerms = {
  agentIdentifier: recordedSeller.agentIdentifier,
  inputHash,
  sellerAddress: recordedSeller.sellerAddress,
  amountAtomic: gate0AmountAtomic,
  unit: tusdmUnit,
  schedule,
};

const signed = (overrides: Record<string, unknown> = {}) =>
  mpsPaymentSchema.parse(paymentJson({ blockchainIdentifier, inputHash, schedule, overrides }));

describe("signed seller terms", () => {
  it("accepts the recorded-good V2 Preprod shape and keeps every signed value", () => {
    const terms = validateSignedTerms(signed(), expected);
    expect(terms).toEqual({
      paymentId: "cmuwpay0000000000000000001",
      blockchainIdentifier,
      agentIdentifier: recordedSeller.agentIdentifier,
      sellerVkey: recordedSeller.sellerVkey,
      sellerAddress: recordedSeller.sellerAddress,
      inputHash,
      payByTime: String(schedule.payByTime),
      submitResultTime: String(schedule.submitResultTime),
      unlockTime: String(schedule.unlockTime),
      externalDisputeUnlockTime: String(schedule.externalDisputeUnlockTime),
      amounts: [{ amount: "1000000", unit: tusdmUnit }],
      policyId: recordedSeller.registryPolicyId,
      smartContractAddress: recordedSeller.smartContractAddress,
    });
  });

  it("accepts terms from an MPS build that signs no forceLayer field", () => {
    const withoutForceLayer = Object.fromEntries(
      Object.entries(paymentJson({ blockchainIdentifier, inputHash, schedule })).filter(
        ([key]) => key !== "forceLayer",
      ),
    );
    expect(() =>
      validateSignedTerms(mpsPaymentSchema.parse(withoutForceLayer), expected),
    ).not.toThrow();
  });

  const funds = (amount: string, unit = tusdmUnit) => [{ amount, unit }];
  const source = (change: Record<string, unknown>) => ({
    PaymentSource: {
      ...(paymentJson({ blockchainIdentifier, inputHash, schedule }).PaymentSource as object),
      ...change,
    },
  });

  it.each([
    ["two tUSDM", { RequestedFunds: funds("2000000") }],
    ["lovelace pricing", { RequestedFunds: funds("1000000", "") }],
    ["a second asset", { RequestedFunds: [...funds("1000000"), ...funds("1", "")] }],
    ["Mainnet", source({ network: "Mainnet" })],
    ["a V1 source", source({ paymentSourceType: "Web3CardanoV1" })],
    ["the tUSDM policy as registry policy", source({ policyId: tusdmUnit.slice(0, 56) })],
    [
      "another seller",
      {
        SmartContractWallet: {
          id: "w",
          walletVkey: recordedSeller.sellerVkey,
          walletAddress: "addr_test1qother",
        },
      },
    ],
    ["a seller return address", { sellerReturnAddress: recordedSeller.sellerAddress }],
    ["an empty-string seller return address", { sellerReturnAddress: "" }],
    ["a forced layer", { forceLayer: "L1" }],
    ["an on-chain state", { onChainState: "FundsLocked" }],
    [
      "a pending action",
      {
        NextAction: {
          requestedAction: "SubmitResultRequested",
          errorType: null,
          errorNote: null,
          resultHash: null,
        },
      },
    ],
    ["another input hash", { inputHash: "f".repeat(64) }],
    ["another agent", { agentIdentifier: `${recordedSeller.registryPolicyId}ff` }],
    ["Fixed pricing", { pricingType: "Fixed" }],
    ["a shifted payBy", { payByTime: String(schedule.payByTime + 1) }],
    ["a shifted submitResult", { submitResultTime: String(schedule.submitResultTime - 1) }],
    ["a default unlock", { unlockTime: String(schedule.submitResultTime + 6 * 3_600_000) }],
    [
      "a default dispute unlock",
      { externalDisputeUnlockTime: String(schedule.submitResultTime + 12 * 3_600_000) },
    ],
    ["no payBy", { payByTime: null }],
  ])("rejects terms with %s", (_label, overrides) => {
    expect(() => validateSignedTerms(signed(overrides), expected)).toThrow(TerminalLifecycleError);
  });

  it("forwards exactly the signed values to Core, without credits", () => {
    const terms = validateSignedTerms(signed(), expected);
    const payload = masumiPaymentPayload(terms, "0123456789abcdef0123", 0);
    expect(payload).toEqual({
      blockchainIdentifier,
      identifierFromPurchaser: "0123456789abcdef0123",
      agentIdentifier: recordedSeller.agentIdentifier,
      sellerVkey: recordedSeller.sellerVkey,
      inputHash,
      payByTime: terms.payByTime,
      submitResultTime: terms.submitResultTime,
      unlockTime: terms.unlockTime,
      externalDisputeUnlockTime: terms.externalDisputeUnlockTime,
      Amounts: [{ amount: "1000000", unit: tusdmUnit }],
      paymentSourceType: "Web3CardanoV2",
      supportedPaymentSourceIndex: 0,
      PaymentSource: {
        network: "Preprod",
        policyId: recordedSeller.agentIdentifier.slice(0, 56),
        smartContractAddress: recordedSeller.smartContractAddress,
      },
    });
    expect(payload).not.toHaveProperty("credits");
  });
});
