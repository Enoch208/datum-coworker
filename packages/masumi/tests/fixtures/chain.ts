import { txSchema, txUtxosSchema, type ChainReader } from "../../src/chain/blockfrost";
import { HttpStatusError } from "../../src/errors";
import collection from "./collection-tx-3837cb22.json";
import { recordedTxs } from "./mps-payment";

export function recordedChain(utxos: unknown = collection.utxos): ChainReader {
  return {
    tx: (hash) =>
      hash === recordedTxs.collection
        ? Promise.resolve(txSchema.parse(collection.tx))
        : Promise.reject(new HttpStatusError("Blockfrost", 404, hash, null)),
    txUtxos: () => Promise.resolve(txUtxosSchema.parse(utxos)),
    tipHeight: () => Promise.resolve(collection.tx.block_height + 9),
  };
}
