import { gate0AmountAtomic, tusdmUnit } from "../../src/constants";
import { buildSchedule } from "../../src/schedule";
import type { TaskReceipt } from "../../src/sokosumi/schemas";
import type { CollectionClaim } from "../../src/verify";
import { recordedResultHash } from "./chain";
import { payment, recordedSeller, recordedTxs } from "./mps-payment";

const blockchainIdentifier = "00E04C0860A60C61066056281180462D0B120001";
export const recordedSchedule = buildSchedule(Date.parse("2026-10-06T02:21:58.062Z"));

export const withdrawnPayment = payment({
  blockchainIdentifier,
  inputHash: "a".repeat(64),
  schedule: recordedSchedule,
  onChainState: "Withdrawn",
  transactions: [
    { txHash: recordedTxs.escrow, previous: null, next: "FundsLocked" },
    { txHash: recordedTxs.result, previous: "FundsLocked", next: "ResultSubmitted" },
    { txHash: recordedTxs.collection, previous: "ResultSubmitted", next: "Withdrawn" },
  ],
});

export const settledReceipt: TaskReceipt = {
  blockchainIdentifier: blockchainIdentifier.toLowerCase(),
  claimStatus: "PURCHASED",
  onChainState: "Withdrawn",
  settled: true,
  txHash: recordedTxs.collection,
  withdrawnForSeller: [],
};

export const recordedClaim: CollectionClaim = {
  blockchainIdentifier,
  collectionTxHash: recordedTxs.collection,
  resultTxHash: recordedTxs.result,
  resultHash: recordedResultHash,
  contractAddress: recordedSeller.smartContractAddress,
  sellerAddress: recordedSeller.sellerAddress,
  unit: tusdmUnit,
  amountAtomic: gate0AmountAtomic,
};

export const verifiedAt = new Date("2026-10-06T03:20:00.000Z");
