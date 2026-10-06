import { TimeQuarterPassIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function LinkInactive() {
  return (
    <section className="pt-6">
      <HugeiconsIcon
        icon={TimeQuarterPassIcon}
        size={32}
        strokeWidth={1.5}
        className="text-muted"
        aria-hidden
      />
      <h1 className="mt-5 text-3xl font-light tracking-tight">This link is no longer active</h1>
      <p className="mt-4 text-lg font-light text-muted">
        Task links stop working when they expire, when they are switched off or when the campaign
        ends. If you still have work to do, ask the person who sent you this link for a new one.
      </p>
    </section>
  );
}
