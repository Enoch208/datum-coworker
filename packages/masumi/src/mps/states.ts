import type { MpsPayment, OnChainState, PaymentTransaction } from "./schemas";

export function confirmedTransition(
  payment: MpsPayment,
  state: OnChainState,
): PaymentTransaction | null {
  const transactions = [payment.CurrentTransaction, ...(payment.TransactionHistory ?? [])];
  return (
    transactions.find(
      (transaction): transaction is PaymentTransaction =>
        transaction !== null &&
        transaction.status === "Confirmed" &&
        transaction.newOnChainState === state &&
        transaction.txHash !== null,
    ) ?? null
  );
}

export function isConfirmedIn(payment: MpsPayment, state: OnChainState): boolean {
  return payment.onChainState === state && confirmedTransition(payment, state) !== null;
}

export const sellerSettledStates: readonly OnChainState[] = ["Withdrawn", "DisputedWithdrawn"];

export const lostPaymentStates: readonly OnChainState[] = [
  "FundsOrDatumInvalid",
  "RefundRequested",
  "Disputed",
  "RefundAuthorized",
  "RefundWithdrawn",
];

export function sellerSettlement(payment: MpsPayment): PaymentTransaction | null {
  if (payment.onChainState === "Withdrawn") {
    return confirmedTransition(payment, "Withdrawn");
  }
  if (payment.onChainState === "DisputedWithdrawn" && payment.WithdrawnForSeller.length > 0) {
    return confirmedTransition(payment, "DisputedWithdrawn");
  }
  return null;
}
