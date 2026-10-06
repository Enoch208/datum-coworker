import type { CampaignReceiptView, ExpenseKind } from "@datum/core";
import { formatWireMoney } from "@/lib/format";
import { ReceiptSection } from "./receipt-section";

const kindLabels: Record<ExpenseKind, string> = {
  RECEIPT: "Checked receipt",
  AGREED_FEE: "Agreed runner fee",
};

export function ReceiptSpend({ receipt }: { receipt: CampaignReceiptView }) {
  const { spend } = receipt;
  return (
    <ReceiptSection
      id="receipt-spend-heading"
      title="Spend"
      note="Physical costs only, each from a checked receipt or an agreed fee. Nothing here was paid through Masumi."
    >
      {spend.lines.length === 0 ? (
        <p className="text-sm text-muted">Nothing was spent.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {spend.lines.map((line) => (
            <li
              key={`${line.taskId}-${line.kind}-${line.label}`}
              className="flex items-baseline justify-between gap-4 py-3"
            >
              <span className="min-w-0">
                <span className="block text-sm break-words text-ink">{line.label}</span>
                <span className="block text-xs text-muted">{kindLabels[line.kind]}</span>
              </span>
              <span className="shrink-0 font-mono text-sm text-ink tabular-nums">
                {formatWireMoney(line.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-5 grid grid-cols-3 gap-4">
        <div>
          <dt className="text-xs text-muted">Spent</dt>
          <dd className="mt-1 font-mono text-lg text-ink tabular-nums">
            {formatWireMoney(spend.confirmed)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Approved</dt>
          <dd className="mt-1 font-mono text-lg text-ink tabular-nums">
            {formatWireMoney(spend.budget)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Left</dt>
          <dd className="mt-1 font-mono text-lg text-ink tabular-nums">
            {formatWireMoney(spend.remaining)}
          </dd>
        </div>
      </dl>
    </ReceiptSection>
  );
}
