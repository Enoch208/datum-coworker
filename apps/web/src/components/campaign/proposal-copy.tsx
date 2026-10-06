import type { ProposalView } from "@datum/core";
import type { ReactNode } from "react";
import { AiProposed } from "@/components/status/provenance";
import { SectionHeading } from "./section-heading";

export function ProposalCopy({ proposal, action }: { proposal: ProposalView; action?: ReactNode }) {
  return (
    <section aria-labelledby="copy-heading">
      <SectionHeading id="copy-heading" title="Public copy">
        <AiProposed model={proposal.plannedBy.model} />
        {action}
      </SectionHeading>
      <blockquote className="mt-6 border-l-2 border-line-strong pl-5">
        <p className="text-2xl font-normal tracking-tight text-balance break-words text-ink sm:text-3xl">
          {proposal.copy.headline}
        </p>
        <p className="mt-3 max-w-2xl text-base text-pretty break-words text-muted sm:text-lg">
          {proposal.copy.subcopy}
        </p>
      </blockquote>
      <p className="mt-4 font-mono text-xs text-muted">Asset version {proposal.assetVersion}</p>
    </section>
  );
}
