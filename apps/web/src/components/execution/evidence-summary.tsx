import { CancelCircleIcon, CheckmarkBadge01Icon, HourglassIcon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { EvidenceVerdict, EvidenceView } from "@datum/core";
import { EvidenceChecks } from "@/components/status/evidence-checks";
import { cx } from "@/lib/cx";
import { formatSgtMoment } from "@/lib/format";

const verdictLines: Record<
  EvidenceVerdict | "PENDING",
  { word: string; icon: IconSvgElement; tone: string }
> = {
  PASS: { word: "Verified", icon: CheckmarkBadge01Icon, tone: "text-ok" },
  FAIL: { word: "Not accepted", icon: CancelCircleIcon, tone: "text-danger" },
  PENDING: { word: "Being checked", icon: HourglassIcon, tone: "text-muted" },
};

export function EvidenceSummary({
  evidence,
  spotCode,
}: {
  evidence: EvidenceView;
  spotCode: string;
}) {
  const line = verdictLines[evidence.verdict ?? "PENDING"];
  return (
    <div className="flex gap-4">
      <a href={evidence.photoUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg">
        <img
          src={evidence.photoUrl}
          alt={`Latest photo sent for spot ${spotCode}`}
          loading="lazy"
          className="size-20 rounded-lg border border-line bg-raised object-cover"
        />
      </a>
      <div className="min-w-0">
        <p className={cx("flex items-center gap-1.5 text-sm font-medium", line.tone)}>
          <HugeiconsIcon icon={line.icon} size={16} strokeWidth={1.8} aria-hidden />
          {line.word}
        </p>
        {evidence.verdict !== null && (
          <div className="mt-1.5">
            <EvidenceChecks checks={evidence.checks} size="sm" />
          </div>
        )}
        <p className="mt-1.5 text-sm break-words text-ink">{evidence.explanation}</p>
        <p className="mt-1.5 font-mono text-xs text-muted tabular-nums">
          Photo {formatSgtMoment(evidence.submittedAt)} SGT
        </p>
      </div>
    </div>
  );
}
