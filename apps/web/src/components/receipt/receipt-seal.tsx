import type { CampaignReceiptView } from "@datum/core";
import { formatSgtMoment } from "@/lib/format";
import { ReceiptSection } from "./receipt-section";

export function ReceiptSeal({ receipt }: { receipt: CampaignReceiptView }) {
  const rows = [
    { label: "Campaign", value: receipt.campaignId },
    { label: "Published", value: `${formatSgtMoment(receipt.publishedAt)} SGT` },
    {
      label: "Physical work by",
      value: receipt.executors.map((executor) => executor.label).join(", ") || "—",
    },
  ];
  return (
    <ReceiptSection
      id="receipt-seal-heading"
      title="Receipt record"
      note="Built from Datum's stored records when the campaign ended. The hash is the SHA-256 of the receipt's stored canonical bytes."
    >
      <p className="text-xs text-muted">sha256</p>
      <p className="mt-1 font-mono text-sm break-all text-accent">{receipt.sha256}</p>
      <dl className="mt-5 divide-y divide-line border-y border-line">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 py-3">
            <dt className="text-sm text-muted">{row.label}</dt>
            <dd className="min-w-0 font-mono text-[13px] break-all text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </ReceiptSection>
  );
}
