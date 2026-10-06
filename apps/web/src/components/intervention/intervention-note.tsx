import { UserEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function InterventionNote() {
  return (
    <p className="flex gap-2.5 rounded-lg border border-line-strong bg-canvas/60 px-3.5 py-3 text-sm text-muted">
      <HugeiconsIcon
        icon={UserEdit01Icon}
        size={18}
        strokeWidth={1.8}
        className="mt-px shrink-0 text-ink"
        aria-hidden
      />
      <span>
        This counts as a <span className="text-ink">manual intervention after approval</span>. Datum
        records your name and the change, adds one to the counter and prints it on the Campaign
        Receipt.
      </span>
    </p>
  );
}
