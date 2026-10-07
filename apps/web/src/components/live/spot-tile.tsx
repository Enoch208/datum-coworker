import { Camera01Icon, RepairIcon, TestTube01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { EvidenceView, SpotView } from "@datum/core";
import { EvidenceChecks } from "@/components/status/evidence-checks";
import { SpotStatusChip } from "@/components/status/spot-status-chip";
import { ToneChip } from "@/components/status/tone-chip";
import { formatSgtMoment, plural } from "@/lib/format";

export function DemoTestLabel({ spotCode }: { spotCode: string }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-[13px] font-medium text-warn">
      <HugeiconsIcon
        icon={TestTube01Icon}
        size={16}
        strokeWidth={1.8}
        className="mt-px shrink-0"
        aria-hidden
      />
      DEMO TEST: first attempt at Spot {spotCode} intentionally failed to test recovery
    </p>
  );
}

function Photo({ spot }: { spot: SpotView }) {
  const evidence = spot.latestEvidence;
  if (evidence === null) {
    return (
      <div className="flex h-32 w-full flex-col items-center justify-center gap-2 bg-raised text-sm text-muted sm:h-40">
        <HugeiconsIcon icon={Camera01Icon} size={22} strokeWidth={1.5} aria-hidden />
        No photo yet
      </div>
    );
  }
  return (
    <a href={evidence.photoUrl} target="_blank" rel="noreferrer" className="block">
      <img
        src={evidence.photoUrl}
        alt={`Latest photo sent for spot ${spot.code}, ${spot.name}`}
        loading="lazy"
        className="aspect-[16/9] w-full bg-raised object-cover sm:aspect-[4/3]"
      />
    </a>
  );
}

function EvidenceLines({ evidence }: { evidence: EvidenceView }) {
  return (
    <div className="flex flex-col gap-2">
      {evidence.verdict === null ? (
        <p className="text-sm text-muted">The photo is being checked.</p>
      ) : (
        <EvidenceChecks checks={evidence.checks} size="sm" />
      )}
      <p className="text-sm break-words text-ink">{evidence.explanation}</p>
      <p className="font-mono text-xs text-muted tabular-nums">
        Photo {formatSgtMoment(evidence.submittedAt)} SGT
      </p>
    </div>
  );
}

export function SpotTile({ spot, attempts }: { spot: SpotView; attempts: number }) {
  const recovered = spot.firstPassStatus === "MISS" && spot.status === "PASS";
  const recovering = spot.firstPassStatus === "MISS" && spot.status === "PENDING";
  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <Photo spot={spot} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line-strong font-mono text-base">
              {spot.code}
            </span>
            <h3 className="min-w-0 text-[15px] font-medium break-words text-ink">{spot.name}</h3>
          </div>
          {recovering ? (
            <ToneChip tone="warn" icon={RepairIcon} label="Recovering" />
          ) : (
            <SpotStatusChip status={spot.status} />
          )}
        </div>
        {spot.inducedMiss === true && <DemoTestLabel spotCode={spot.code} />}
        <div className="flex flex-wrap items-center gap-2">
          {recovered && <ToneChip tone="accent" icon={RepairIcon} label="Recovered after a miss" />}
          <span className="font-mono text-xs text-muted tabular-nums">
            {plural(attempts, "attempt")} · {plural(spot.scanCount, "scan")}
          </span>
        </div>
        {spot.latestEvidence !== null && <EvidenceLines evidence={spot.latestEvidence} />}
      </div>
    </li>
  );
}
