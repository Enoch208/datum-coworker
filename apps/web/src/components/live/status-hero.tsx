import { ArrowRight01Icon, Certificate01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CampaignView, GoalStateView } from "@datum/core";
import { Link } from "react-router";
import { primaryButton } from "@/components/feedback/buttons";
import { CampaignStatusChip } from "@/components/status/campaign-status-chip";
import { hasReceipt, isRunning } from "@/lib/campaign-phase";
import { cx } from "@/lib/cx";
import { formatSgtClock } from "@/lib/format";
import { receiptHref } from "@/lib/routes";
import { GoalProgress } from "./goal-progress";
import { heroDetail, heroHeadline } from "./hero-words";
import { LiveFacts } from "./live-facts";

function LiveMark({ fetchedAt, stale }: { fetchedAt: number | null; stale: boolean }) {
  if (fetchedAt === null) return null;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 font-mono text-xs tabular-nums",
        stale ? "text-warn" : "text-muted",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "size-1.5 rounded-full",
          stale ? "bg-warn" : "bg-accent motion-safe:animate-pulse",
        )}
      />
      {stale ? "Not updating · last read" : "Live · read"} {formatSgtClock(fetchedAt)}
    </span>
  );
}

function ReceiptLink({ campaignId }: { campaignId: string }) {
  return (
    <Link to={receiptHref(campaignId)} className={`${primaryButton} w-full sm:w-auto`}>
      <HugeiconsIcon icon={Certificate01Icon} size={18} strokeWidth={1.8} aria-hidden />
      View the Campaign Receipt
      <HugeiconsIcon icon={ArrowRight01Icon} size={18} strokeWidth={1.8} aria-hidden />
    </Link>
  );
}

export function StatusHero({
  campaign,
  goal,
  interventions,
  fetchedAt,
  stale,
}: {
  campaign: CampaignView;
  goal: GoalStateView | null;
  interventions: number | null;
  fetchedAt: number | null;
  stale: boolean;
}) {
  const passed = goal?.passed ?? campaign.spots.filter((spot) => spot.status === "PASS").length;
  const required = goal?.required ?? campaign.spots.length;
  return (
    <section
      aria-labelledby="hero-heading"
      className="rounded-3xl border border-line bg-surface px-5 py-7 sm:px-10 sm:py-10"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <CampaignStatusChip status={campaign.status} />
          <span className="font-mono text-xs break-all text-muted">{campaign.id}</span>
        </div>
        {isRunning(campaign.status) && <LiveMark fetchedAt={fetchedAt} stale={stale} />}
      </div>
      <p className="mt-8 text-sm text-muted">{campaign.brand.name}</p>
      <h1
        id="hero-heading"
        className="mt-2 text-4xl font-light tracking-tight text-balance text-ink sm:text-6xl"
      >
        {heroHeadline(campaign.status)}
      </h1>
      <p className="mt-4 max-w-2xl text-base font-light text-muted sm:text-lg">
        {heroDetail(campaign, goal)}
      </p>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
        <GoalProgress passed={passed} required={required} spots={campaign.spots} />
        <LiveFacts campaign={campaign} goal={goal} interventions={interventions} />
      </div>
      {hasReceipt(campaign.status) && (
        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            The outcome, the spend and every proof are published as one receipt.
          </p>
          <ReceiptLink campaignId={campaign.id} />
        </div>
      )}
    </section>
  );
}
