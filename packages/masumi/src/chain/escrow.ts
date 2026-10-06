import { TerminalLifecycleError } from "../errors";
import type { TxUtxos } from "./blockfrost";

type TxOutput = TxUtxos["outputs"][number];

export interface EscrowLocation {
  readonly resultTxHash: string;
  readonly resultHash: string;
  readonly contractAddress: string;
}

const cborBytes32Prefix = "5820";

function carriesResult(output: TxOutput, resultHash: string): boolean {
  return (
    output.inline_datum !== null &&
    output.inline_datum.includes(`${cborBytes32Prefix}${resultHash}`)
  );
}

export function escrowOutput(resultUtxos: TxUtxos, location: EscrowLocation): TxOutput {
  const candidates = resultUtxos.outputs.filter(
    (output) =>
      output.address === location.contractAddress &&
      !output.collateral &&
      carriesResult(output, location.resultHash),
  );
  const [escrow] = candidates;
  if (escrow === undefined || candidates.length !== 1) {
    throw new TerminalLifecycleError(
      `ResultSubmitted tx ${location.resultTxHash} has ${String(candidates.length)} contract outputs whose datum carries this payment's result hash; expected exactly 1`,
    );
  }
  return escrow;
}

export function spendsOutput(utxos: TxUtxos, txHash: string, outputIndex: number): boolean {
  return utxos.inputs.some(
    (input) =>
      input.tx_hash === txHash &&
      input.output_index === outputIndex &&
      !input.collateral &&
      input.reference !== true,
  );
}
