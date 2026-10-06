import { CancelCircleIcon, CheckmarkBadge01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { EvidenceView } from "@datum/core";
import { EvidenceChecks } from "@/components/status/evidence-checks";
import { ByRules } from "@/components/status/provenance";
import { cx } from "@/lib/cx";
import { formatSgtMoment } from "@/lib/format";
import { Spinner } from "./step-buttons";

function Headline({ evidence, spotCode }: { evidence: EvidenceView; spotCode: string }) {
  if (evidence.verdict === "PASS") {
    return (
      <p className="flex items-center gap-2 text-xl font-medium text-ok">
        <HugeiconsIcon icon={CheckmarkBadge01Icon} size={24} strokeWidth={1.8} aria-hidden />
        Spot {spotCode} verified
      </p>
    );
  }
  if (evidence.verdict === "FAIL") {
    return (
      <p className="flex items-center gap-2 text-xl font-medium text-danger">
        <HugeiconsIcon icon={CancelCircleIcon} size={24} strokeWidth={1.8} aria-hidden />
        Not accepted
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 text-xl font-medium text-ink">
      <Spinner />
      Checking this photo…
    </p>
  );
}

export function VerdictView({ evidence, spotCode }: { evidence: EvidenceView; spotCode: string }) {
  return (
    <div
      role="status"
      className={cx(
        "rounded-2xl border p-4",
        evidence.verdict === "PASS" && "border-ok/40 bg-ok/5",
        evidence.verdict === "FAIL" && "border-danger/40 bg-danger/5",
        evidence.verdict === null && "border-line-strong",
      )}
    >
      <Headline evidence={evidence} spotCode={spotCode} />
      {evidence.verdict !== null && (
        <div className="mt-3">
          <EvidenceChecks checks={evidence.checks} size="md" />
        </div>
      )}
      <p className="mt-3 text-[17px] leading-snug break-words text-ink">{evidence.explanation}</p>
      <div className="mt-4 flex items-center gap-3">
        <img
          src={evidence.photoUrl}
          alt="The photo you sent"
          className="size-16 shrink-0 rounded-lg border border-line object-cover"
        />
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          {evidence.verdict !== null && <ByRules label="Checked by rules" />}
          <span className="font-mono text-xs text-muted tabular-nums">
            Sent {formatSgtMoment(evidence.submittedAt)} SGT
          </span>
        </div>
      </div>
    </div>
  );
}
