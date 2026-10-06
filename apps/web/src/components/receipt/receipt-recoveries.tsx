import { AiBrain01Icon, CalculatorIcon } from "@hugeicons/core-free-icons";
import type { CampaignReceiptView, InterventionAction, RecoverySource } from "@datum/core";
import { KeyText } from "@/components/status/key-text";
import { ToneChip, type ChipSpec } from "@/components/status/tone-chip";
import { formatSgtMoment, formatWireMoney, spotList } from "@/lib/format";
import { ReceiptSection } from "./receipt-section";

const sourceChips: Record<RecoverySource, ChipSpec> = {
  MODEL: { tone: "neutral", icon: AiBrain01Icon, label: "Planned by the model, checked by rules" },
  FALLBACK: { tone: "neutral", icon: CalculatorIcon, label: "Standard recovery by rules" },
};

const actionLabels: Record<InterventionAction, string> = {
  BUDGET_RAISED: "Raised the budget",
  EXPENSE_ACCEPTED: "Accepted a disputed receipt",
};

function Recoveries({ receipt }: { receipt: CampaignReceiptView }) {
  if (receipt.recoveries.length === 0) {
    return <p className="text-sm text-muted">No recovery was needed.</p>;
  }
  return (
    <ol className="flex flex-col gap-4">
      {receipt.recoveries.map((recovery) => (
        <li key={recovery.idempotencyKey} className="rounded-xl border border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] text-ink">
              Round {recovery.round}: {spotList(recovery.spotCodes)}
            </p>
            <ToneChip {...sourceChips[recovery.source]} />
          </div>
          <p className="mt-2 font-mono text-xs text-ink">
            <KeyText value={recovery.idempotencyKey} />
          </p>
          <p className="mt-2 font-mono text-xs text-muted tabular-nums">
            {formatWireMoney(recovery.estimatedCost)} · dispatched{" "}
            {formatSgtMoment(recovery.dispatchedAt)} SGT
          </p>
        </li>
      ))}
    </ol>
  );
}

function Interventions({ receipt }: { receipt: CampaignReceiptView }) {
  if (receipt.interventions.length === 0) {
    return <p className="text-sm text-muted">None recorded after approval.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {receipt.interventions.map((item) => (
        <li key={`${item.at}-${item.action}`} className="text-sm">
          <p className="text-ink">
            {actionLabels[item.action]} · {item.actorName}
            <span className="text-muted">
              {" "}
              ({item.actor === "CUSTOMER" ? "customer" : "operator"})
            </span>
          </p>
          <p className="mt-0.5 text-muted">{item.reason}</p>
          <p className="mt-0.5 font-mono text-xs text-muted">{formatSgtMoment(item.at)} SGT</p>
        </li>
      ))}
    </ul>
  );
}

export function ReceiptRecoveries({ receipt }: { receipt: CampaignReceiptView }) {
  return (
    <ReceiptSection
      id="receipt-recovery-heading"
      title="Recovery and interventions"
      note="Recoveries are commissioned by the Goal Loop from the evidence. Every action a person took after approval is counted here."
    >
      <h3 className="eyebrow text-muted">Automatic recoveries · {receipt.recoveryActions}</h3>
      <div className="mt-3">
        <Recoveries receipt={receipt} />
      </div>
      <h3 className="eyebrow mt-8 text-muted">
        Manual interventions after approval · {receipt.postApprovalInterventions}
      </h3>
      <div className="mt-3">
        <Interventions receipt={receipt} />
      </div>
    </ReceiptSection>
  );
}
