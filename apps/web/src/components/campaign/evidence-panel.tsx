import { Camera01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { EvidencePolicy } from "@datum/core";
import { ByRules } from "@/components/status/provenance";
import { formatSgt } from "@/lib/format";
import { SectionHeading } from "./section-heading";

const policyText: Record<EvidencePolicy, string> = {
  photo_with_decodable_spot_qr: "One photo per spot, showing that spot's own QR code, taken before",
};

export function EvidencePanel({ policy, deadline }: { policy: EvidencePolicy; deadline: string }) {
  return (
    <section aria-labelledby="evidence-heading">
      <SectionHeading id="evidence-heading" title="Proof Datum accepts">
        <ByRules label="Checked by rules" />
      </SectionHeading>
      <div className="mt-6 flex gap-4 rounded-xl border border-line p-5">
        <HugeiconsIcon
          icon={Camera01Icon}
          size={22}
          strokeWidth={1.5}
          className="mt-0.5 shrink-0 text-muted"
          aria-hidden
        />
        <div>
          <p className="text-[15px] text-ink">
            {policyText[policy]} <span className="font-mono">{formatSgt(deadline)}</span>.
          </p>
          <p className="mt-2 text-sm text-muted">
            A photo with no readable code, another spot&apos;s code or a late timestamp does not
            count. QR scans are reported, but they never decide whether a spot is live.
          </p>
        </div>
      </div>
    </section>
  );
}
