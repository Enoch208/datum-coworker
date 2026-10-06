import { LockIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ApprovalView, CampaignView } from "@datum/core";
import { formatSgt, formatWireMoney, shortHash } from "@/lib/format";
import { BoundsList, Mono, SpotCodes } from "./bounds-list";

export function LockedPanel({
  campaign,
  approval,
}: {
  campaign: CampaignView;
  approval: ApprovalView;
}) {
  const rows = [
    {
      label: "Public copy",
      value: (
        <>
          {approval.copy.headline}
          <span className="mt-1 block text-muted">{approval.copy.subcopy}</span>
        </>
      ),
    },
    {
      label: "Card design",
      value: (
        <Mono title={approval.assetHash}>
          v{approval.assetVersion} · {shortHash(approval.assetHash)}
        </Mono>
      ),
    },
    {
      label: "Spots",
      value: (
        <>
          <SpotCodes codes={campaign.spots.map((spot) => spot.code)} />
          <span className="mt-1.5 block">
            <Mono title={approval.spotsHash}>set {shortHash(approval.spotsHash)}</Mono>
          </span>
        </>
      ),
    },
    { label: "Budget cap", value: <Mono>{formatWireMoney(approval.budget)}</Mono> },
    { label: "Deadline", value: <Mono>{formatSgt(approval.deadline)}</Mono> },
    { label: "Proof", value: "One photo per spot showing that spot's own QR code" },
  ];
  return (
    <section
      aria-labelledby="locked-heading"
      className="rounded-2xl border border-line bg-surface p-6"
    >
      <div className="flex items-center gap-2 text-ok">
        <HugeiconsIcon icon={LockIcon} size={18} strokeWidth={1.8} aria-hidden />
        <h2 id="locked-heading" className="text-base font-medium">
          Approved and locked
        </h2>
      </div>
      <p className="mt-2 text-sm text-muted">
        By <span className="text-ink">{approval.approvedBy}</span> ·{" "}
        <Mono>{formatSgt(approval.approvedAt)}</Mono>
      </p>
      <div className="mt-5">
        <BoundsList rows={rows} />
      </div>
      <p className="mt-5 text-sm text-muted">
        Datum now works on its own within these bounds. It comes back to you only to change the copy
        or the spots, or to spend more than{" "}
        <span className="font-mono text-ink">{formatWireMoney(approval.budget)}</span>.
      </p>
    </section>
  );
}
