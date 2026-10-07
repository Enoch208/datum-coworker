import type { MasumiProofView } from "@datum/core";
import { describe, expect, it } from "vitest";
import { paymentSteps, stepWord } from "../src/components/receipt/payment-steps";

const hash = (digit: string): string => digit.repeat(64);

const pending: MasumiProofView = {
  sokosumiTaskId: "task_1",
  paymentId: "pay_1",
  blockchainIdentifier: "bc_1",
  resultHash: hash("a"),
  sellerAddress: "addr_test1",
  tokenUnit: "unit",
  escrowTxHash: null,
  resultTxHash: null,
  collectionTxHash: null,
  netReceivedAtomic: null,
  collectionConfirmed: false,
  verifiedAt: null,
};

const collected: MasumiProofView = {
  ...pending,
  collectionTxHash: hash("3"),
  netReceivedAtomic: "1000000",
  collectionConfirmed: true,
  verifiedAt: "2026-10-07T12:00:00.000Z",
};

const states = (proof: MasumiProofView) => paymentSteps(proof).map((step) => step.state);
const links = (proof: MasumiProofView) => paymentSteps(proof).map((step) => step.txHash);

describe("the payment steps on a campaign receipt", () => {
  it("waits on every step before any transaction is known", () => {
    expect(states(pending)).toEqual(["waiting", "waiting", "waiting", "waiting"]);
    expect(paymentSteps(pending).map(stepWord)).toEqual([
      "Not locked yet",
      "Not submitted yet",
      "Checked after the payout",
      "Not collected yet",
    ]);
  });

  it("links the escrow and result transactions as confirmed while the payout is still due", () => {
    const awaitingPayout = { ...pending, escrowTxHash: hash("1"), resultTxHash: hash("2") };
    expect(states(awaitingPayout)).toEqual(["confirmed", "confirmed", "waiting", "waiting"]);
    expect(links(awaitingPayout)).toEqual([hash("1"), hash("2"), null, null]);
    expect(paymentSteps(awaitingPayout).map(stepWord).slice(0, 2)).toEqual([
      "Confirmed",
      "Confirmed",
    ]);
  });

  it("verifies the result, the match and the collection only after the chain check", () => {
    const paid = { ...collected, escrowTxHash: hash("1"), resultTxHash: hash("2") };
    expect(states(paid)).toEqual(["confirmed", "verified", "verified", "verified"]);
    expect(links(paid)).toEqual([hash("1"), hash("2"), null, hash("3")]);
  });

  it("never calls the escrow verified, because Datum does not re-read it", () => {
    const paid = { ...collected, escrowTxHash: hash("1"), resultTxHash: hash("2") };
    expect(paymentSteps(paid).find((step) => step.key === "escrow")?.state).toBe("confirmed");
  });

  it("reads a collection verified before transactions were kept as complete, with no links", () => {
    expect(states(collected)).toEqual(["confirmed", "verified", "verified", "verified"]);
    expect(links(collected)).toEqual([null, null, null, hash("3")]);
  });

  it("does not treat a recorded collection transaction as verified until it is confirmed", () => {
    const unconfirmed = { ...pending, collectionTxHash: hash("3") };
    expect(states(unconfirmed).at(-1)).toBe("waiting");
    expect(links(unconfirmed).at(-1)).toBe(hash("3"));
  });
});
