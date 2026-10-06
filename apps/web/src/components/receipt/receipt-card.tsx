import { ImageNotFound01Icon, RepairIcon, TestTube01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CampaignReceiptView, ReceiptSpotView } from "@datum/core";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { CampaignStatusChip } from "@/components/status/campaign-status-chip";
import { SpotStatusChip } from "@/components/status/spot-status-chip";
import { cx } from "@/lib/cx";
import { formatSgtHour, formatWireMoney, shortHash } from "@/lib/format";
import { outcomeHeadline } from "./outcome-words";

function Stat({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs leading-snug text-muted">{label}</dt>
      <dd
        className={cx(
          "font-mono text-2xl text-ink tabular-nums",
          strong === true ? "font-normal" : "font-light",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Thumb({ spot }: { spot: ReceiptSpotView }) {
  return (
    <li className="relative overflow-hidden rounded-xl border border-line bg-raised">
      {spot.evidencePhotoUrl === null ? (
        <div className="flex aspect-[4/3] items-center justify-center text-muted">
          <HugeiconsIcon icon={ImageNotFound01Icon} size={22} strokeWidth={1.5} aria-hidden />
        </div>
      ) : (
        <img
          src={spot.evidencePhotoUrl}
          alt={`Evidence photo for spot ${spot.spotCode}`}
          className="aspect-[4/3] w-full object-cover"
        />
      )}
      {spot.recoveredAfterMiss && (
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full border border-ink/30 bg-canvas/85 px-2 py-0.5 text-[11px] font-medium text-ink">
          <HugeiconsIcon icon={RepairIcon} size={12} strokeWidth={1.8} aria-hidden />
          Recovered after a miss
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-canvas/85 px-2.5 py-1.5">
        <span className="font-mono text-sm text-ink">{spot.spotCode}</span>
        <SpotStatusChip status={spot.final} />
      </div>
    </li>
  );
}

function InducedNote({ spots }: { spots: readonly ReceiptSpotView[] }) {
  const induced = spots.filter((spot) => spot.inducedMiss).map((spot) => spot.spotCode);
  if (induced.length === 0) return null;
  return (
    <p className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-warn">
      <HugeiconsIcon icon={TestTube01Icon} size={15} strokeWidth={1.8} aria-hidden />
      {induced
        .map((code) => `DEMO TEST: Spot ${code} intentionally skipped to test recovery`)
        .join(" · ")}
    </p>
  );
}

function Footer({ receipt }: { receipt: CampaignReceiptView }) {
  const done = receipt.actual.completedAt;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 text-sm sm:grid-cols-4">
      <div>
        <dt className="text-xs text-muted">{done === null ? "Ended" : "Completed"}</dt>
        <dd className="mt-1 font-mono text-ink tabular-nums">
          {done === null ? "not complete" : formatSgtHour(done)}
          <span className="block text-xs text-muted">
            deadline {formatSgtHour(receipt.target.deadline)}
          </span>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Physical spend</dt>
        <dd className="mt-1 font-mono text-ink tabular-nums">
          {formatWireMoney(receipt.spend.confirmed)}
          <span className="block text-xs text-muted">
            of {formatWireMoney(receipt.spend.budget)} approved
          </span>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Physical work by</dt>
        <dd className="mt-1 text-ink">
          {receipt.executors.map((executor) => executor.label).join(", ") || "—"}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Receipt sha256</dt>
        <dd className="mt-1 font-mono text-ink" title={receipt.sha256}>
          {shortHash(receipt.sha256)}
        </dd>
      </div>
    </dl>
  );
}

export function ReceiptCard({ receipt }: { receipt: CampaignReceiptView }) {
  return (
    <article
      id="receipt-card"
      aria-labelledby="receipt-heading"
      className="flex flex-col gap-8 rounded-3xl border border-line bg-surface p-5 sm:p-10 xl:h-[630px] xl:gap-0 xl:p-12"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="print:brightness-0">
            <BrandMark height={22} />
          </span>
          <span className="eyebrow text-muted">Campaign Receipt</span>
        </div>
        <CampaignStatusChip status={receipt.status} />
      </header>
      <div className="grid gap-8 xl:mt-8 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_25rem] xl:gap-12">
        <div className="flex min-w-0 flex-col">
          <p className="text-base break-words text-muted">{receipt.campaignName}</p>
          <h1 id="receipt-heading" className="mt-1 text-3xl font-medium tracking-tight sm:text-4xl">
            {outcomeHeadline(receipt)}
          </h1>
          <p className="mt-6 font-mono text-8xl leading-none font-extralight tracking-tighter tabular-nums xl:text-[8.5rem]">
            <span className="text-ink">{receipt.actual.spotsPassed}</span>
            <span className="mx-1 text-faint">/</span>
            <span className="text-faint">{receipt.target.spots}</span>
          </p>
          <p className="mt-3 text-base text-muted">
            approved spots live, each proven by its own photo
          </p>
          <InducedNote spots={receipt.spots} />
          <dl className="mt-8 grid grid-cols-3 gap-6 xl:mt-auto">
            <Stat
              label="First pass"
              value={`${String(receipt.firstPass.passed)}/${String(receipt.firstPass.required)}`}
            />
            <Stat label="Automatic recoveries" value={receipt.recoveryActions} />
            <Stat
              label="Manual interventions after approval"
              value={receipt.postApprovalInterventions}
              strong={receipt.postApprovalInterventions === 0}
            />
          </dl>
        </div>
        <ul className="grid grid-cols-2 content-start gap-3 print:grid-cols-4">
          {receipt.spots.map((spot) => (
            <Thumb key={spot.spotCode} spot={spot} />
          ))}
        </ul>
      </div>
      <div className="xl:mt-8">
        <Footer receipt={receipt} />
      </div>
    </article>
  );
}
