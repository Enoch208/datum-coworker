import { describe, expect, it } from "vitest";
import { sellerNetAtomic, txUtxosSchema, type TxUtxos } from "../src/chain/blockfrost";
import { gate0AmountAtomic, tusdmUnit } from "../src/constants";
import { TerminalLifecycleError } from "../src/errors";
import { buildSchedule } from "../src/schedule";
import type { TaskReceipt } from "../src/sokosumi/schemas";
import { verifyCollection, type CollectionClaim } from "../src/verify";
import collection from "./fixtures/collection-tx-3837cb22.json";
import { payment, recordedSeller, recordedTxs } from "./fixtures/mps-payment";
import { recordedChain } from "./fixtures/chain";

const recorded: TxUtxos = txUtxosSchema.parse(collection.utxos);
const blockchainIdentifier = "00E04C0860A60C61066056281180462D0B120001";

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
    const padded: TxUtxos = {
      ...recorded,
      inputs: [
        ...recorded.inputs,
        { address: seller, amount: token("7"), collateral: true, reference: false },
        { address: seller, amount: token("9"), collateral: false, reference: true },
      ],
      outputs: [...recorded.outputs, { address: seller, amount: token("5"), collateral: true }],
    };
    expect(sellerNetAtomic(padded, seller, tusdmUnit)).toBe(1_000_000n);
  });

  it("is zero for an address that took no part", () => {
    expect(sellerNetAtomic(recorded, "addr_test1qnobody", tusdmUnit)).toBe(0n);
  });
});

describe("verifyCollection", () => {
  const schedule = buildSchedule(Date.parse("2026-10-06T02:21:58.062Z"));
  const withdrawn = payment({
    blockchainIdentifier,
    inputHash: "a".repeat(64),
    schedule,
    onChainState: "Withdrawn",
    transactions: [
      { txHash: recordedTxs.escrow, previous: null, next: "FundsLocked" },
      { txHash: recordedTxs.result, previous: "FundsLocked", next: "ResultSubmitted" },
      { txHash: recordedTxs.collection, previous: "ResultSubmitted", next: "Withdrawn" },
    ],
  });
  const receipt: TaskReceipt = {
    blockchainIdentifier: blockchainIdentifier.toLowerCase(),
    claimStatus: "PURCHASED",
    onChainState: "Withdrawn",
    settled: true,
    txHash: recordedTxs.collection,
    withdrawnForSeller: [],
  };
  const claim: CollectionClaim = {
    blockchainIdentifier,
    collectionTxHash: recordedTxs.collection,
    sellerAddress: recordedSeller.sellerAddress,
    unit: tusdmUnit,
    expectedNetAtomic: gate0AmountAtomic,
  };
  const now = new Date("2026-10-06T03:20:00.000Z");

  it("proves the recorded collection with a measured net and confirmations", async () => {
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
          blockchainIdentifier,
          inputHash: "a".repeat(64),
          schedule,
          onChainState: "ResultSubmitted",
        }),
      },
    ],
    ["a seller that is not ours", { claim: { ...claim, sellerAddress: "addr_test1qnobody" } }],
    ["a larger expected amount", { claim: { ...claim, expectedNetAtomic: "2000000" } }],
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
