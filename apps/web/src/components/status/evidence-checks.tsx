import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { EvidenceCheckView } from "@datum/core";
import { cx } from "@/lib/cx";

const checkLabels: Record<keyof EvidenceCheckView, string> = {
  photoReceived: "Photo received",
  qrDetected: "QR detected",
  campaignMatches: "Campaign",
  spotMatches: "Spot",
  taskOpen: "Task open",
  beforeDeadline: "Before deadline",
};

const checkOrder: readonly (keyof EvidenceCheckView)[] = [
  "photoReceived",
  "qrDetected",
  "campaignMatches",
  "spotMatches",
  "taskOpen",
  "beforeDeadline",
];

export function EvidenceChecks({ checks, size }: { checks: EvidenceCheckView; size: "sm" | "md" }) {
  const ordered = [
    ...checkOrder.filter((key) => !checks[key]),
    ...checkOrder.filter((key) => checks[key]),
  ];
  return (
    <ul
      aria-label="Checks on this photo"
      className={cx(
        "flex flex-wrap gap-x-3 gap-y-1.5",
        size === "md" ? "text-[15px]" : "text-[13px]",
      )}
    >
      {ordered.map((key) => (
        <li
          key={key}
          className={cx(
            "inline-flex items-center gap-1",
            checks[key] ? "text-muted" : "font-medium text-danger",
          )}
        >
          <HugeiconsIcon
            icon={checks[key] ? Tick02Icon : Cancel01Icon}
            size={size === "md" ? 16 : 14}
            strokeWidth={2.2}
            aria-hidden
          />
          {checkLabels[key]}
          <span className="sr-only">{checks[key] ? "passed" : "failed"}</span>
        </li>
      ))}
    </ul>
  );
}
