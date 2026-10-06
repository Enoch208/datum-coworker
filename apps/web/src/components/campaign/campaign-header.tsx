import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CampaignView } from "@datum/core";
import type { ReactNode } from "react";
import { CampaignStatusChip } from "@/components/status/campaign-status-chip";
import { formatSgt, formatWireMoney } from "@/lib/format";

function Fact({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1.5 border-t border-line pt-4 ${wide ? "col-span-2 lg:col-span-1" : ""}`}
    >
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="min-w-0 font-mono text-[15px] text-ink tabular-nums">{children}</dd>
    </div>
  );
}

export function CampaignHeader({ campaign }: { campaign: CampaignView }) {
  return (
    <header className="surface-card p-5 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <CampaignStatusChip status={campaign.status} />
        <span className="font-mono text-xs text-muted">{campaign.id}</span>
      </div>
      <h1 className="mt-6 text-3xl font-medium tracking-tight text-balance break-words sm:text-5xl">
        {campaign.brand.name}
      </h1>
      <p className="mt-4 max-w-3xl text-lg font-light text-pretty break-words text-muted sm:text-xl">
        {campaign.message}
      </p>
      <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
        <Fact label="Deadline" wide>
          {formatSgt(campaign.deadline)}
        </Fact>
        <Fact label="Physical budget">{formatWireMoney(campaign.budget)}</Fact>
        <Fact label="Approved spots">{campaign.spots.length}</Fact>
        <Fact label="QR codes send people to" wide>
          <a
            href={campaign.destinationUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1 text-sm text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            <span className="truncate">{campaign.destinationUrl.replace(/^https?:\/\//, "")}</span>
            <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} strokeWidth={1.8} aria-hidden />
          </a>
        </Fact>
      </dl>
    </header>
  );
}
