import { FileDownloadIcon, ImageNotFound01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { SpotView } from "@datum/core";
import { useState } from "react";
import { secondaryButton } from "@/components/feedback/buttons";

function CardImage({ spot }: { spot: SpotView }) {
  const [failed, setFailed] = useState(false);
  if (spot.card === null || failed) {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-8 text-center text-sm text-muted">
        <HugeiconsIcon icon={ImageNotFound01Icon} size={24} strokeWidth={1.5} aria-hidden />
        {spot.card === null
          ? "No card yet. Datum renders it with the proposal."
          : "The card image did not load."}
      </div>
    );
  }
  return (
    <img
      src={spot.card.pngUrl}
      alt={`Print card for spot ${spot.code}, ${spot.name}, with its own QR code`}
      loading="lazy"
      onError={() => {
        setFailed(true);
      }}
      className="w-full rounded-xl border border-line bg-raised"
    />
  );
}

function SpotCard({ spot }: { spot: SpotView }) {
  return (
    <li className="flex flex-col gap-5">
      <CardImage spot={spot} />
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line-strong font-mono text-base">
            {spot.code}
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-medium break-words text-ink">{spot.name}</h3>
            <p className="mt-1 text-sm break-words text-muted">{spot.instructions}</p>
          </div>
        </div>
        <p className="shrink-0 text-right font-mono text-sm text-ink tabular-nums">
          {spot.scanCount}
          <span className="block text-xs text-muted">
            {spot.scanCount === 1 ? "scan" : "scans"}
          </span>
        </p>
      </div>
      <div className="rounded-lg border border-line px-3 py-2.5">
        <p className="text-xs text-muted">Spot {spot.code} QR opens</p>
        <p className="mt-1 font-mono text-xs break-all text-ink">{spot.qrTargetUrl}</p>
      </div>
      {spot.card !== null && (
        <a href={spot.card.pdfUrl} download className={`${secondaryButton} self-start`}>
          <HugeiconsIcon icon={FileDownloadIcon} size={16} strokeWidth={1.8} aria-hidden />
          Download print PDF
        </a>
      )}
    </li>
  );
}

export function SpotCards({ spots }: { spots: readonly SpotView[] }) {
  return (
    <section aria-labelledby="cards-heading">
      <h2 id="cards-heading" className="text-2xl font-light tracking-tight">
        One card per spot
      </h2>
      <p className="mt-2 max-w-2xl text-[15px] font-light text-muted">
        Every card carries its own QR code. A photo from a spot only counts when it shows that
        spot&apos;s code.
      </p>
      <ul className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2">
        {spots.map((spot) => (
          <SpotCard key={spot.id} spot={spot} />
        ))}
      </ul>
    </section>
  );
}
