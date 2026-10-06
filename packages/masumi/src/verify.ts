import { z } from "zod";
import { sellerNetAtomic, type ChainReader } from "./chain/blockfrost";
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
  readonly sellerAddress: string;
  readonly unit: string;
  readonly expectedNetAtomic: string;
}

const txHashPattern = /^[0-9a-f]{64}$/;

export async function verifyCollection(
  claim: CollectionClaim,
  receipt: TaskReceipt,
  payment: MpsPayment,
  chain: ChainReader,
  now: Date,
): Promise<CollectionProof> {
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

  const tx = await chain.tx(claim.collectionTxHash);
  const utxos = await chain.txUtxos(claim.collectionTxHash);
  const tipHeight = await chain.tipHeight();
  if (tx.hash !== claim.collectionTxHash || utxos.hash !== claim.collectionTxHash) {
    throw new TerminalLifecycleError("Chain answered for a different transaction");
  }
  if (!tx.valid_contract) {
    throw new TerminalLifecycleError("Collection tx failed script validation on chain");
  }
  if (tipHeight < tx.block_height) {
    throw new TerminalLifecycleError("Chain tip is below the collection block");
  }
  const net = sellerNetAtomic(utxos, claim.sellerAddress, claim.unit);
  if (net !== BigInt(claim.expectedNetAtomic)) {
    throw new TerminalLifecycleError(
      `Seller net on chain is ${net.toString()}, expected ${claim.expectedNetAtomic}`,
    );
  }
  return {
    txHash: claim.collectionTxHash,
    netReceivedAtomic: net.toString(),
    blockHeight: tx.block_height,
    confirmations: tipHeight - tx.block_height + 1,
    receiptOnChainState: receipt.onChainState ?? "unknown",
    verifiedAt: now.toISOString(),
  };
}
