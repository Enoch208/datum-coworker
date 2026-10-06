import { CancelCircleIcon, CheckmarkBadge01Icon } from "@hugeicons/core-free-icons";
import type { CampaignReceiptView } from "@datum/core";
import type { ReactNode } from "react";
import { ToneChip } from "@/components/status/tone-chip";
import { formatSgtShort, formatWireMoney } from "@/lib/format";
import { finishedEarly, withinBudget } from "./outcome-words";
import { ReceiptSection } from "./receipt-section";

function Verdict({ met, yes, no }: { met: boolean; yes: string; no: string }) {
  return met ? (
    <ToneChip tone="ok" icon={CheckmarkBadge01Icon} label={yes} />
  ) : (
    <ToneChip tone="danger" icon={CancelCircleIcon} label={no} />
  );
}

function Row({
  label,
  target,
  actual,
  verdict,
}: {
  label: string;
  target: string;
  actual: string;
  verdict: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-normal text-ink">{label}</h3>
        {verdict}
      </div>
      <p className="grid grid-cols-2 gap-4 font-mono text-sm tabular-nums">
        <span className="text-muted">
          <span className="block font-sans text-xs">Approved</span>
          {target}
        </span>
        <span className="text-ink">
          <span className="block font-sans text-xs text-muted">Actual</span>
          {actual}
        </span>
      </p>
    </li>
  );
}

export function TargetActual({ receipt }: { receipt: CampaignReceiptView }) {
  const { target, actual } = receipt;
  const allLive = actual.spotsPassed === target.spots;
  const early = finishedEarly(receipt);
  return (
    <ReceiptSection id="target-heading" title="Target and actual">
      <ul className="-my-4 divide-y divide-line">
        <Row
          label="Spots live"
          target={`${String(target.spots)} spots`}
          actual={`${String(actual.spotsPassed)} live`}
          verdict={<Verdict met={allLive} yes="All live" no="Not all live" />}
        />
        <Row
          label="Deadline"
          target={formatSgtShort(target.deadline)}
          actual={
            actual.completedAt === null ? "not completed" : formatSgtShort(actual.completedAt)
          }
          verdict={<Verdict met={early !== null} yes="On time" no="Missed" />}
        />
        <Row
          label="Physical budget"
          target={formatWireMoney(target.budget)}
          actual={formatWireMoney(actual.spend)}
          verdict={<Verdict met={withinBudget(receipt)} yes="Within budget" no="Over budget" />}
        />
      </ul>
      {early !== null && <p className="mt-6 text-sm text-muted">Completed {early}.</p>}
    </ReceiptSection>
  );
}
