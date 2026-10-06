import {
  Alert02Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  TimeQuarterPassIcon,
} from "@hugeicons/core-free-icons";
import type {
  RemediationOutcome,
  RemediationRejection,
  RemediationVerdictView,
  WireMoney,
} from "@datum/core";
import { ToneChip, type ChipSpec } from "@/components/status/tone-chip";
import { formatWireMoney } from "@/lib/format";

const outcomeChips: Record<RemediationOutcome, ChipSpec> = {
  ACCEPTED: { tone: "ok", icon: CheckmarkCircle02Icon, label: "Accepted" },
  REJECTED: { tone: "danger", icon: CancelCircleIcon, label: "Rejected" },
  NEEDS_APPROVAL: { tone: "warn", icon: Alert02Icon, label: "Needs your approval" },
  EXPIRED: { tone: "danger", icon: TimeQuarterPassIcon, label: "Expired" },
};

const rejectionWords: Record<RemediationRejection, string> = {
  EMPTY_PLAN: "the plan had no actions",
  EMPTY_ACTION: "an action named no spot",
  ASSET_NOT_APPROVED: "it used a card version that is not approved",
  COPY_CHANGED: "it changed the approved copy",
  DUE_AFTER_DEADLINE: "it was due after the deadline",
  DUE_BEFORE_NOW: "it was due in the past",
  SPOT_NOT_APPROVED: "it named a spot that is not approved",
  SPOT_REPEATED_IN_PLAN: "it named the same spot twice",
  SPOT_NOT_UNRESOLVED: "it named a spot that is already resolved",
  DUPLICATE_OPEN_TASK: "it would open a second task for the same recovery",
  SPOT_HAS_OPEN_TASK: "the spot already has an open task",
  SPOT_LEFT_UNPLANNED: "it left an unresolved spot without an action",
};

export function OutcomeChip({ outcome }: { outcome: RemediationOutcome }) {
  return <ToneChip {...outcomeChips[outcome]} />;
}

const outcomeMeaning = (verdict: RemediationVerdictView): string => {
  switch (verdict.outcome) {
    case "ACCEPTED":
      return "Every action is for an approved, unresolved spot, uses the approved card, is due before the deadline and fits the budget that is left.";
    case "NEEDS_APPROVAL":
      return "The recovery costs more than the budget that is left, so Datum stopped and asked you instead of overspending.";
    case "EXPIRED":
      return "The deadline passed before the recovery could run.";
    case "REJECTED":
      return `The plan was not used because ${verdict.reason === null ? "it broke a rule" : rejectionWords[verdict.reason]}${verdict.spotCode === null ? "" : ` (Spot ${verdict.spotCode})`}.`;
  }
};

function MoneyFact({ label, money }: { label: string; money: WireMoney | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-t border-line pt-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-sm text-ink tabular-nums sm:text-base">
        {money === null ? "—" : formatWireMoney(money)}
      </dd>
    </div>
  );
}

export function VerdictBlock({ verdict }: { verdict: RemediationVerdictView }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <OutcomeChip outcome={verdict.outcome} />
        {verdict.reason !== null && (
          <span className="font-mono text-xs text-muted">{verdict.reason}</span>
        )}
      </div>
      <p className="text-[15px] text-ink">{outcomeMeaning(verdict)}</p>
      <dl className="grid grid-cols-3 gap-x-4">
        <MoneyFact label="Cost" money={verdict.planCost} />
        <MoneyFact label="Shortfall" money={verdict.shortfall} />
        <MoneyFact label="Revised maximum" money={verdict.revisedMaximum} />
      </dl>
    </div>
  );
}
