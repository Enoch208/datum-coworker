import { ArrowRight01Icon, ImageNotFound01Icon, RepairIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CampaignReceiptView, ReceiptSpotView } from "@datum/core";
import { DemoTestLabel } from "@/components/live/spot-tile";
import { SpotStatusChip } from "@/components/status/spot-status-chip";
import { ToneChip } from "@/components/status/tone-chip";
import { formatSgtMoment, plural } from "@/lib/format";
import { ReceiptSection } from "./receipt-section";

function Photo({ spot }: { spot: ReceiptSpotView }) {
  if (spot.evidencePhotoUrl === null) {
    return (
      <div className="flex size-20 shrink-0 items-center justify-center rounded-xl border border-dashed border-line-strong text-faint sm:size-28">
        <HugeiconsIcon icon={ImageNotFound01Icon} size={20} strokeWidth={1.5} aria-hidden />
      </div>
    );
  }
  return (
    <a href={spot.evidencePhotoUrl} target="_blank" rel="noreferrer" className="shrink-0">
      <img
        src={spot.evidencePhotoUrl}
        alt={`Evidence photo for spot ${spot.spotCode}, ${spot.name}`}
        className="size-20 rounded-xl border border-line bg-raised object-cover sm:size-28"
      />
    </a>
  );
}

function SpotRow({ spot }: { spot: ReceiptSpotView }) {
  return (
    <li className="flex gap-4 py-5 break-inside-avoid">
      <Photo spot={spot} />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <p className="flex items-baseline gap-2.5">
          <span className="font-mono text-base text-ink">{spot.spotCode}</span>
          <span className="min-w-0 text-[15px] break-words text-ink">{spot.name}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>First pass</span>
          <SpotStatusChip status={spot.firstPass} />
          <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={1.8} aria-hidden />
          <span>Final</span>
          <SpotStatusChip status={spot.final} />
        </div>
        {spot.recoveredAfterMiss && (
          <div>
            <ToneChip tone="accent" icon={RepairIcon} label="Recovered after a miss" />
          </div>
        )}
        {spot.inducedMiss && <DemoTestLabel spotCode={spot.spotCode} />}
        <p className="font-mono text-xs text-muted tabular-nums">
          {plural(spot.attempts, "attempt")} · {plural(spot.scans, "scan")}
          {spot.passedAt === null ? "" : ` · proven ${formatSgtMoment(spot.passedAt)} SGT`}
        </p>
      </div>
    </li>
  );
}

export function ReceiptSpots({ receipt }: { receipt: CampaignReceiptView }) {
  return (
    <ReceiptSection
      id="receipt-spots-heading"
      title="Spot by spot"
      note={`${plural(receipt.totalScans, "QR scan")} in total. Scans are reported, never used to decide whether a spot is live.`}
    >
      <ul className="-my-5 divide-y divide-line">
        {receipt.spots.map((spot) => (
          <SpotRow key={spot.spotCode} spot={spot} />
        ))}
      </ul>
    </ReceiptSection>
  );
}
