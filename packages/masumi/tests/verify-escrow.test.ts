import { describe, expect, it } from "vitest";
import type { TxUtxos } from "../src/chain/blockfrost";
import { tusdmUnit } from "../src/constants";
import type { TaskReceipt } from "../src/sokosumi/schemas";
import { verifyCollection } from "../src/verify";
import { recordedChain, recordedResultHash, resultUtxosNaming } from "./fixtures/chain";
import {
  recordedClaim as claim,
  settledReceipt as receipt,
  verifiedAt as now,
  withdrawnPayment as withdrawn,
} from "./fixtures/collection-claim";
import { recordedSeller, recordedTxs } from "./fixtures/mps-payment";

const seller = recordedSeller.sellerAddress;
const contract = recordedSeller.smartContractAddress;
const otherResultTx = "9f".repeat(32);
const tokens = (quantity: string) => [
  { unit: "lovelace", quantity: "2000000" },
  { unit: tusdmUnit, quantity },
];

const spending = (txHash: string, index: number, address: string, quantity: string) => ({
  address,
  amount: tokens(quantity),
  tx_hash: txHash,
  output_index: index,
  collateral: false,
  reference: false,
});
const paying = (index: number, address: string, quantity: string, datum: string | null = null) => ({
  address,
  amount: tokens(quantity),
  output_index: index,
  inline_datum: datum,
  collateral: false,
});

function collectionTx(escrows: TxUtxos["inputs"], sellerPayout: string): TxUtxos {
  return {
    hash: recordedTxs.collection,
    inputs: [spending("4391dc1b".repeat(8), 1, seller, "100000000"), ...escrows],
    outputs: [paying(0, seller, sellerPayout), paying(1, seller, "100000000")],
  };
}

const ourEscrow = spending(recordedTxs.result, 0, contract, "1000000");
const otherEscrow = spending(otherResultTx, 0, contract, "1000000");
const verifyWith = (collection: TxUtxos, result: TxUtxos = resultUtxosNaming(recordedResultHash)) =>
  verifyCollection(
    claim,
    receipt,
    withdrawn,
    recordedChain(collection, () => result),
    now,
  );

const datumNaming = (resultHash: string) =>
  resultUtxosNaming(resultHash).outputs[0]?.inline_datum ?? null;

function batchedResultTx(ourDatum: string | null, otherDatum: string | null): TxUtxos {
  const recorded = resultUtxosNaming(recordedResultHash);
  return {
    ...recorded,
    outputs: [
      ...recorded.outputs.map((output) =>
        output.address === contract ? { ...output, inline_datum: ourDatum } : output,
      ),
      paying(3, contract, "1000000", otherDatum),
    ],
  };
}

describe("collection verification against this payment's escrow output", () => {
  it("proves a batched collection that spends two escrows and nets the seller +2", async () => {
    const batched = collectionTx([ourEscrow, otherEscrow], "2000000");
    await expect(verifyWith(batched)).resolves.toMatchObject({
      txHash: recordedTxs.collection,
      netReceivedAtomic: "1000000",
    });
  });

  it("refuses a collection tx that spends another escrow but not ours", async () => {
    const elsewhere = collectionTx([otherEscrow], "1000000");
    await expect(verifyWith(elsewhere)).rejects.toThrow("does not spend this payment's escrow");
  });

  it("refuses a collection tx that only references our escrow output", async () => {
    const referenced = collectionTx([{ ...ourEscrow, reference: true }, otherEscrow], "1000000");
    await expect(verifyWith(referenced)).rejects.toThrow("does not spend this payment's escrow");
  });

  it("refuses a seller net below this payment's amount", async () => {
    const short = collectionTx([ourEscrow], "999999");
    await expect(verifyWith(short)).rejects.toThrow("Seller net on chain is 999999");
  });

  it("refuses an escrow output that holds a different amount", async () => {
    const recorded = resultUtxosNaming(recordedResultHash);
    const inflated = {
      ...recorded,
      outputs: recorded.outputs.map((output) =>
        output.address === contract ? { ...output, amount: tokens("2000000") } : output,
      ),
    };
    await expect(verifyWith(collectionTx([ourEscrow], "2000000"), inflated)).rejects.toThrow(
      "holds 2000000",
    );
  });

  it("finds our escrow in a batched ResultSubmitted tx by the result hash in its datum", async () => {
    const result = batchedResultTx(datumNaming(recordedResultHash), datumNaming("c".repeat(64)));
    await expect(verifyWith(collectionTx([ourEscrow], "1000000"), result)).resolves.toMatchObject({
      netReceivedAtomic: "1000000",
    });
    const theirs = spending(recordedTxs.result, 3, contract, "1000000");
    await expect(verifyWith(collectionTx([theirs], "1000000"), result)).rejects.toThrow(
      "does not spend this payment's escrow",
    );
  });

  it("refuses a batched ResultSubmitted tx whose escrow outputs carry no datum", async () => {
    const ambiguous = batchedResultTx(null, null);
    await expect(verifyWith(collectionTx([ourEscrow], "1000000"), ambiguous)).rejects.toThrow(
      "0 contract outputs",
    );
  });

  it("refuses a lone contract output whose datum does not prove our result hash", async () => {
    const recorded = resultUtxosNaming(recordedResultHash);
    const datumless = {
      ...recorded,
      outputs: recorded.outputs.map((output) =>
        output.address === contract ? { ...output, inline_datum: null } : output,
      ),
    };
    await expect(verifyWith(collectionTx([ourEscrow], "1000000"), datumless)).rejects.toThrow(
      "0 contract outputs",
    );
  });
});

describe("Core receipt withdrawnForSeller", () => {
  const collection = collectionTx([ourEscrow], "1000000");
  const withPayout = (withdrawnForSeller: TaskReceipt["withdrawnForSeller"]) =>
    verifyCollection(
      claim,
      { ...receipt, withdrawnForSeller },
      withdrawn,
      recordedChain(collection, () => resultUtxosNaming(recordedResultHash)),
      now,
    );

  it("accepts an ordinary Withdrawn whose withdrawnForSeller is empty", async () => {
    await expect(withPayout([])).resolves.toMatchObject({ netReceivedAtomic: "1000000" });
  });

  it("accepts a withdrawnForSeller entry with exactly this payment's amount", async () => {
    await expect(withPayout([{ unit: tusdmUnit, amount: "1000000" }])).resolves.toMatchObject({
      txHash: recordedTxs.collection,
    });
  });

  it.each([
    ["a different amount", [{ unit: tusdmUnit, amount: "2000000" }]],
    ["no tUSDM entry", [{ unit: "lovelace", amount: "1000000" }]],
  ])("refuses a withdrawnForSeller with %s", async (_label, payout) => {
    await expect(withPayout(payout)).rejects.toThrow("withdrawnForSeller");
  });
});
