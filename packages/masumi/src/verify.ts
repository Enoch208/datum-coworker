import { z } from "zod";
import {
  sellerNetAtomic,
  unitQuantity,
  type ChainReader,
  type ChainTx,
  type TxUtxos,
} from "./chain/blockfrost";
import { escrowOutput, spendsOutput } from "./chain/escrow";
import { TerminalLifecycleError } from "./errors";
import type { MpsPayment } from "./mps/schemas";
import { sellerSettlement } from "./mps/states";
import type { TaskReceipt } from "./sokosumi/schemas";

export const collectionProofSchema = z.object({
  txHash: z.string(),
  netReceivedAtomic: z.string(),
  blockHeight: z.number().int(),
  confirmations: z.number().int(),
  receiptOnChainState: z.string(),
  verifiedAt: z.string(),
});
export type CollectionProof = z.infer<typeof collectionProofSchema>;

export interface CollectionClaim {
  readonly blockchainIdentifier: string;
  readonly collectionTxHash: string;
  readonly resultTxHash: string;
  readonly resultHash: string;
  readonly contractAddress: string;
  readonly sellerAddress: string;
  readonly unit: string;
  readonly amountAtomic: string;
}

const txHashPattern = /^[0-9a-f]{64}$/;

function receiptPayoutAgrees(receipt: TaskReceipt, claim: CollectionClaim): boolean {
  if (receipt.withdrawnForSeller.length === 0) {
    return true;
  }
  const payouts = receipt.withdrawnForSeller.filter((entry) => entry.unit === claim.unit);
  return payouts.length === 1 && payouts[0]?.amount === claim.amountAtomic;
}

function assertRecordsAgree(claim: CollectionClaim, receipt: TaskReceipt, payment: MpsPayment) {
  const settlement = sellerSettlement(payment);
  const failures: [boolean, string][] = [
    [receipt.settled, "Core receipt is not settled"],
    [
      receipt.blockchainIdentifier?.toLowerCase() === claim.blockchainIdentifier.toLowerCase(),
      "Core receipt names a different payment",
    ],
    [
      receipt.txHash === claim.collectionTxHash,
      "Core receipt txHash differs from MPS Withdrawn tx",
    ],
    [
      receiptPayoutAgrees(receipt, claim),
      `Core receipt withdrawnForSeller does not hold exactly ${claim.amountAtomic} of the token`,
    ],
    [txHashPattern.test(claim.collectionTxHash), "collection tx hash is not 64 lowercase hex"],
    [
      settlement !== null && settlement.txHash === claim.collectionTxHash,
      "MPS has no confirmed seller settlement with this tx hash",
    ],
  ];
  const broken = failures.filter(([holds]) => !holds).map(([, reason]) => reason);
  if (broken.length > 0) {
    throw new TerminalLifecycleError(`Collection is not proven: ${broken.join("; ")}`);
  }
}

function assertSpendsOurEscrow(claim: CollectionClaim, collection: TxUtxos, result: TxUtxos) {
  const escrow = escrowOutput(result, claim);
  const reference = `${claim.resultTxHash}#${String(escrow.output_index)}`;
  const locked = unitQuantity(escrow.amount, claim.unit);
  if (locked !== BigInt(claim.amountAtomic)) {
    throw new TerminalLifecycleError(
      `Escrow output ${reference} holds ${locked.toString()} of the token, expected ${claim.amountAtomic}`,
    );
  }
  if (!spendsOutput(collection, claim.resultTxHash, escrow.output_index)) {
    throw new TerminalLifecycleError(
      `Collection tx does not spend this payment's escrow output ${reference}`,
    );
  }
  const net = sellerNetAtomic(collection, claim.sellerAddress, claim.unit);
  if (net < locked) {
    throw new TerminalLifecycleError(
      `Seller net on chain is ${net.toString()}, below this payment's ${claim.amountAtomic}`,
    );
  }
  return locked;
}

function assertSettledTx(tx: ChainTx, tipHeight: number) {
  if (!tx.valid_contract) {
    throw new TerminalLifecycleError("Collection tx failed script validation on chain");
  }
  if (tipHeight < tx.block_height) {
    throw new TerminalLifecycleError("Chain tip is below the collection block");
  }
}

export async function verifyCollection(
  claim: CollectionClaim,
  receipt: TaskReceipt,
  payment: MpsPayment,
  chain: ChainReader,
  now: Date,
): Promise<CollectionProof> {
  assertRecordsAgree(claim, receipt, payment);
  const tx = await chain.tx(claim.collectionTxHash);
  const collection = await chain.txUtxos(claim.collectionTxHash);
  const result = await chain.txUtxos(claim.resultTxHash);
  const tipHeight = await chain.tipHeight();
  if (
    tx.hash !== claim.collectionTxHash ||
    collection.hash !== claim.collectionTxHash ||
    result.hash !== claim.resultTxHash
  ) {
    throw new TerminalLifecycleError("Chain answered for a different transaction");
  }
  assertSettledTx(tx, tipHeight);
  const received = assertSpendsOurEscrow(claim, collection, result);
  return {
    txHash: claim.collectionTxHash,
    netReceivedAtomic: received.toString(),
    blockHeight: tx.block_height,
    confirmations: tipHeight - tx.block_height + 1,
    receiptOnChainState: receipt.onChainState ?? "unknown",
    verifiedAt: now.toISOString(),
  };
}
