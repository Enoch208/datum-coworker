import type { MasumiProofView } from "@datum/core";

export type PaymentStepState = "waiting" | "confirmed" | "verified";

export interface PaymentStep {
  readonly key: "escrow" | "result" | "match" | "collection";
  readonly label: string;
  readonly state: PaymentStepState;
  readonly waitingNote: string;
  readonly txHash: string | null;
}

function escrowState(proof: MasumiProofView): PaymentStepState {
  return proof.escrowTxHash !== null || proof.collectionConfirmed ? "confirmed" : "waiting";
}

function resultState(proof: MasumiProofView): PaymentStepState {
  if (proof.collectionConfirmed) return "verified";
  return proof.resultTxHash === null ? "waiting" : "confirmed";
}

export function paymentSteps(proof: MasumiProofView): PaymentStep[] {
  const checked: PaymentStepState = proof.collectionConfirmed ? "verified" : "waiting";
  return [
    {
      key: "escrow",
      label: "Funds locked",
      state: escrowState(proof),
      waitingNote: "Not locked yet",
      txHash: proof.escrowTxHash,
    },
    {
      key: "result",
      label: "Result submitted",
      state: resultState(proof),
      waitingNote: "Not submitted yet",
      txHash: proof.resultTxHash,
    },
    {
      key: "match",
      label: "Result matches",
      state: checked,
      waitingNote: "Checked after the payout",
      txHash: null,
    },
    {
      key: "collection",
      label: "Seller collection",
      state: checked,
      waitingNote: "Not collected yet",
      txHash: proof.collectionTxHash,
    },
  ];
}

export function stepWord(step: PaymentStep): string {
  if (step.state === "waiting") return step.waitingNote;
  return step.state === "verified" ? "Verified" : "Confirmed";
}
