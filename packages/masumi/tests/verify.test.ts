import { describe, expect, it } from "vitest";
import { sellerNetAtomic, txUtxosSchema, type TxUtxos } from "../src/chain/blockfrost";
import { tusdmUnit } from "../src/constants";
import { TerminalLifecycleError } from "../src/errors";
import type { TaskReceipt } from "../src/sokosumi/schemas";
import { verifyCollection, type CollectionClaim } from "../src/verify";
import { recordedChain } from "./fixtures/chain";
import {
  recordedClaim as claim,
  recordedSchedule,
  settledReceipt as receipt,
  verifiedAt as now,
  withdrawnPayment as withdrawn,
} from "./fixtures/collection-claim";
import collection from "./fixtures/collection-tx-3837cb22.json";
import { payment, recordedSeller, recordedTxs } from "./fixtures/mps-payment";

const recorded: TxUtxos = txUtxosSchema.parse(collection.utxos);

describe("seller net from the recorded collection tx 3837cb22", () => {
  it("is exactly +1 tUSDM for the seller", () => {
    expect(sellerNetAtomic(recorded, recordedSeller.sellerAddress, tusdmUnit)).toBe(1_000_000n);
  });

  it("is not the gross output, because the seller also spent 100 tUSDM", () => {
    const gross = recorded.outputs
      .filter((output) => output.address === recordedSeller.sellerAddress)
      .flatMap((output) => output.amount)
      .filter((amount) => amount.unit === tusdmUnit)
      .reduce((sum, amount) => sum + BigInt(amount.quantity), 0n);
    expect(gross).toBe(101_000_000n);
  });

  it("ignores collateral inputs, collateral outputs and reference inputs", () => {
    const token = (quantity: string) => [{ unit: tusdmUnit, quantity }];
    const seller = recordedSeller.sellerAddress;
    const spent = { tx_hash: recordedTxs.escrow, output_index: 7 };
    const padded: TxUtxos = {
      ...recorded,
      inputs: [
        ...recorded.inputs,
        { ...spent, address: seller, amount: token("7"), collateral: true, reference: false },
        { ...spent, address: seller, amount: token("9"), collateral: false, reference: true },
      ],
      outputs: [
        ...recorded.outputs,
        {
          address: seller,
          amount: token("5"),
          output_index: 9,
          inline_datum: null,
          collateral: true,
        },
      ],
    };
    expect(sellerNetAtomic(padded, seller, tusdmUnit)).toBe(1_000_000n);
  });

  it("is zero for an address that took no part", () => {
    expect(sellerNetAtomic(recorded, "addr_test1qnobody", tusdmUnit)).toBe(0n);
  });
});

describe("verifyCollection", () => {
  it("proves the recorded collection spent this payment's escrow output", async () => {
    await expect(
      verifyCollection(claim, receipt, withdrawn, recordedChain(), now),
    ).resolves.toEqual({
      txHash: recordedTxs.collection,
      netReceivedAtomic: "1000000",
      blockHeight: 5259041,
      confirmations: 10,
      receiptOnChainState: "Withdrawn",
      verifiedAt: "2026-10-06T03:20:00.000Z",
    });
  });

  it.each([
    ["an unsettled receipt", { receipt: { ...receipt, settled: false } }],
    ["a receipt for another payment", { receipt: { ...receipt, blockchainIdentifier: "ff" } }],
    ["a receipt with another tx", { receipt: { ...receipt, txHash: recordedTxs.result } }],
    [
      "no MPS Withdrawn tx",
      {
        mps: payment({
          blockchainIdentifier: claim.blockchainIdentifier,
          inputHash: "a".repeat(64),
          schedule: recordedSchedule,
          onChainState: "ResultSubmitted",
        }),
      },
    ],
    ["a seller that is not ours", { claim: { ...claim, sellerAddress: "addr_test1qnobody" } }],
    ["a larger expected amount", { claim: { ...claim, amountAtomic: "2000000" } }],
    ["another payment's result hash", { claim: { ...claim, resultHash: "b".repeat(64) } }],
    ["another contract address", { claim: { ...claim, contractAddress: "addr_test1wother" } }],
  ])(
    "refuses %s",
    async (
      _label,
      change: { receipt?: TaskReceipt; mps?: typeof withdrawn; claim?: CollectionClaim },
    ) => {
      await expect(
        verifyCollection(
          change.claim ?? claim,
          change.receipt ?? receipt,
          change.mps ?? withdrawn,
          recordedChain(),
          now,
        ),
      ).rejects.toThrow(TerminalLifecycleError);
    },
  );

  it("refuses a collection tx that failed script validation", async () => {
    const chain = {
      ...recordedChain(),
      tx: () =>
        Promise.resolve({
          hash: recordedTxs.collection,
          block_height: 5259041,
          valid_contract: false,
        }),
    };
    await expect(verifyCollection(claim, receipt, withdrawn, chain, now)).rejects.toThrow(
      "failed script validation",
    );
  });
});
