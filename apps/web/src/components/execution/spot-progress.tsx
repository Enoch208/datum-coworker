import type { SpotView } from "@datum/core";
import { SectionHeading } from "@/components/campaign/section-heading";
import { ByRules } from "@/components/status/provenance";
import { SpotStatusChip } from "@/components/status/spot-status-chip";
import { EvidenceSummary } from "./evidence-summary";

function SpotRow({ spot }: { spot: SpotView }) {
  return (
    <li className="py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line-strong font-mono text-base">
            {spot.code}
          </span>
          <p className="min-w-0 text-base font-medium break-words text-ink">{spot.name}</p>
        </div>
        <SpotStatusChip status={spot.status} />
      </div>
      <div className="mt-4 sm:pl-12">
        {spot.latestEvidence === null ? (
          <p className="text-sm text-muted">No photo yet.</p>
        ) : (
          <EvidenceSummary evidence={spot.latestEvidence} spotCode={spot.code} />
        )}
      </div>
    </li>
  );
}

export function SpotProgress({ spots }: { spots: readonly SpotView[] }) {
  const passed = spots.filter((spot) => spot.status === "PASS").length;
  return (
    <section aria-labelledby="spots-heading">
      <SectionHeading id="spots-heading" title="Spots">
        <ByRules label="Checked by rules" />
      </SectionHeading>
      <p className="mt-2 max-w-2xl text-[15px] font-light text-muted">
        <span className="font-mono text-ink tabular-nums">
          {passed} / {spots.length}
        </span>{" "}
        spots verified. A spot counts only when its photo shows that spot&apos;s own QR code.
      </p>
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {spots.map((spot) => (
          <SpotRow key={spot.id} spot={spot} />
        ))}
      </ul>
    </section>
  );
}
