import {
  txSchema,
  txUtxosSchema,
  type ChainReader,
  type TxUtxos,
} from "../../src/chain/blockfrost";
import { HttpStatusError } from "../../src/errors";
import collection from "./collection-tx-3837cb22.json";
import { recordedTxs } from "./mps-payment";
import resultSubmitted from "./result-tx-b96438fd.json";

export const recordedResultHash =
  "edad5b4bcd527e69afb06bf0199aae4d3d31cd9632d371822c56ba631a1568a1";

export function resultUtxosNaming(resultHash: string): TxUtxos {
  const utxos = txUtxosSchema.parse(resultSubmitted);
  return {
    ...utxos,
    outputs: utxos.outputs.map((output) => ({
      ...output,
      inline_datum: output.inline_datum?.replace(recordedResultHash, resultHash) ?? null,
    })),
  };
}

export function recordedChain(
  collectionUtxos: unknown = collection.utxos,
  resultUtxos: () => unknown = () => resultSubmitted,
): ChainReader {
  const missing = (hash: string) =>
    Promise.reject(new HttpStatusError("Blockfrost", 404, hash, null));
  return {
    tx: (hash) =>
      hash === recordedTxs.collection
        ? Promise.resolve(txSchema.parse(collection.tx))
        : missing(hash),
    txUtxos: (hash) => {
      if (hash === recordedTxs.collection) {
        return Promise.resolve(txUtxosSchema.parse(collectionUtxos));
      }
      if (hash === recordedTxs.result) {
        return Promise.resolve(txUtxosSchema.parse(resultUtxos()));
      }
      return missing(hash);
    },
    tipHeight: () => Promise.resolve(collection.tx.block_height + 9),
  };
}
