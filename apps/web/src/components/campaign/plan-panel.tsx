import type { CampaignView, PlanStep, PrintFormat, ProposalView } from "@datum/core";
import { AiProposed, ByRules } from "@/components/status/provenance";
import { formatWireMoney } from "@/lib/format";
import { SectionHeading } from "./section-heading";
import { SpendBar } from "./spend-bar";

function stepText(step: PlanStep, format: PrintFormat, campaign: CampaignView): string {
  if (step.type === "PRINT_AND_COLLECT") {
    return `Print and collect ${String(step.quantity)} ${format} ${step.quantity === 1 ? "card" : "cards"}`;
  }
  const spot = campaign.spots.find((candidate) => candidate.code === step.spotCode);
  return `Place the card at spot ${step.spotCode}${spot === undefined ? "" : ` · ${spot.name}`}`;
}

export function PlanPanel({
  campaign,
  proposal,
}: {
  campaign: CampaignView;
  proposal: ProposalView;
}) {
  return (
    <section aria-labelledby="plan-heading">
      <SectionHeading id="plan-heading" title="Plan">
        <AiProposed model={proposal.plannedBy.model} />
      </SectionHeading>
      <p className="mt-2 text-[15px] font-light text-muted">
        Print format <span className="font-mono text-ink">{proposal.printFormat}</span>
      </p>
      <div className="mt-6 flex items-center justify-between gap-3 border-b border-line pb-3 text-xs text-muted">
        <span>Step</span>
        <ByRules label="Estimates computed by rules" />
      </div>
      <ol className="divide-y divide-line">
        {proposal.steps.map((step, index) => (
          <li key={`${step.type}-${String(index)}`} className="flex items-baseline gap-4 py-3.5">
            <span className="w-5 shrink-0 font-mono text-xs text-muted tabular-nums">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 text-[15px] break-words text-ink">
              {stepText(step, proposal.printFormat, campaign)}
            </span>
            <span className="shrink-0 font-mono text-sm text-ink tabular-nums">
              {formatWireMoney(step.estimatedCost)}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-8 rounded-xl border border-line p-5">
        <p className="mb-3 text-xs text-muted">Estimated spend</p>
        <SpendBar estimate={proposal.estimatedSpend} budget={campaign.budget} />
      </div>
    </section>
  );
}
