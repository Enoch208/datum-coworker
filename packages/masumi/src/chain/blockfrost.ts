import { z } from "zod";
import { HttpStatusError } from "../errors";
import { joinUrl, sendJson, type FetchLike } from "../http";
import { parseShape } from "../parse";

const quantity = z.string().regex(/^\d+$/);
const assetAmount = z.object({ unit: z.string(), quantity });

const outputIndex = z.number().int().nonnegative();

export const txUtxosSchema = z.object({
  hash: z.string(),
  inputs: z.array(
    z.object({
      address: z.string(),
      amount: z.array(assetAmount),
      tx_hash: z.string(),
      output_index: outputIndex,
      collateral: z.boolean(),
      reference: z.boolean().optional(),
    }),
  ),
  outputs: z.array(
    z.object({
      address: z.string(),
      amount: z.array(assetAmount),
      output_index: outputIndex,
      inline_datum: z.string().nullable(),
      collateral: z.boolean(),
    }),
  ),
});
export type TxUtxos = z.infer<typeof txUtxosSchema>;

export const txSchema = z.object({
  hash: z.string(),
  block_height: z.number().int().nonnegative(),
  valid_contract: z.boolean(),
});
export type ChainTx = z.infer<typeof txSchema>;

const latestBlockSchema = z.object({ height: z.number().int().nonnegative() });

export interface ChainReader {
  tx(hash: string): Promise<ChainTx>;
  txUtxos(hash: string): Promise<TxUtxos>;
  tipHeight(): Promise<number>;
}

export interface BlockfrostConnection {
  readonly baseUrl: string;
  readonly projectId: string;
  readonly fetch: FetchLike;
}

export function createBlockfrostReader(connection: BlockfrostConnection): ChainReader {
  async function get<Schema extends z.ZodType>(
    path: string,
    schema: Schema,
  ): Promise<z.output<Schema>> {
    const reply = await sendJson(connection.fetch, {
      method: "GET",
      url: joinUrl(connection.baseUrl, path),
      headers: { project_id: connection.projectId },
    });
    if (reply.status !== 200) {
      throw new HttpStatusError("Blockfrost", reply.status, path, null);
    }
    return parseShape(`Blockfrost ${path}`, schema, reply.body);
  }

  return {
    tx: (hash) => get(`/txs/${encodeURIComponent(hash)}`, txSchema),
    txUtxos: (hash) => get(`/txs/${encodeURIComponent(hash)}/utxos`, txUtxosSchema),
    tipHeight: async () => (await get("/blocks/latest", latestBlockSchema)).height,
  };
}

type AssetAmount = z.infer<typeof assetAmount>;

export function unitQuantity(amounts: readonly AssetAmount[], unit: string): bigint {
  return amounts
    .filter((amount) => amount.unit === unit)
    .reduce((sum, amount) => sum + BigInt(amount.quantity), 0n);
}

export function sellerNetAtomic(utxos: TxUtxos, sellerAddress: string, unit: string): bigint {
  const total = (
    entries: readonly {
      address: string;
      amount: readonly AssetAmount[];
      collateral: boolean;
      reference?: boolean | undefined;
    }[],
  ) =>
    unitQuantity(
      entries
        .filter((entry) => entry.address === sellerAddress && !entry.collateral && !entry.reference)
        .flatMap((entry) => entry.amount),
      unit,
    );
  return total(utxos.outputs) - total(utxos.inputs);
}
