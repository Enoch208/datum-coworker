import type { StateAt } from "../lifecycle/state";

const explorer = (txHash: string) => `https://preprod.cardanoscan.io/transaction/${txHash}`;

export function verifiedSummary(state: StateAt<"verified">, unit: string): string[] {
  return [
    `Sokosumi Task        ${state.taskId}`,
    `MPS payment          ${state.terms.paymentId}`,
    `Purchaser nonce      ${state.nonce}`,
    `Input hash           ${state.inputHash}`,
    `Signed deadlines     payBy ${state.terms.payByTime} submitResult ${state.terms.submitResultTime} unlock ${state.terms.unlockTime} dispute ${state.terms.externalDisputeUnlockTime}`,
    `Payment event        ${state.paymentEventId ?? "attached (event id reconciled from receipt)"}`,
    `Escrow tx            ${explorer(state.escrowTxHash)}`,
    `Result hash          ${state.result.hash}`,
    `Result tx            ${explorer(state.resultTxHash)}`,
    `Completion event     ${state.completionEventId ?? "unknown"}`,
    `Collection tx        ${explorer(state.proof.txHash)}`,
    `Seller address       ${state.terms.sellerAddress}`,
    `Token unit           ${unit}`,
    `Seller net received  ${state.proof.netReceivedAtomic} atomic (${String(state.proof.confirmations)} confirmations at height ${String(state.proof.blockHeight)})`,
    `Verified at          ${state.proof.verifiedAt}`,
  ];
}
