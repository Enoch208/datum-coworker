import {
  isCopyEditable,
  type CampaignView,
  type ProposalView,
  type TimelineEventView,
} from "@datum/core";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { ApprovalPanel } from "@/components/approval/approval-panel";
import { approvalState, isFinal } from "@/components/approval/approval-state";
import { LaunchPanel } from "@/components/approval/launch-panel";
import { LockedPanel } from "@/components/approval/locked-panel";
import type { StartFailure } from "@/components/approval/start-failure";
import { secondaryButton } from "@/components/feedback/buttons";
import { CampaignHeader } from "./campaign-header";
import { CopySection } from "./copy-section";
import { NoProposal } from "./no-proposal";
import { ProposalDetails } from "./proposal-sections";
import type { Resource } from "@/lib/use-resource";
import { SpotCards } from "./spot-cards";
import { Timeline } from "./timeline";

function ApprovalAside({
  campaign,
  proposal,
  reload,
}: {
  campaign: CampaignView;
  proposal: ProposalView;
  reload: () => void;
}) {
  const [startFailure, setStartFailure] = useState<StartFailure | null>(null);
  const state = approvalState(campaign);
  if (state === "current" && campaign.approval !== null) {
    return (
      <div className="flex flex-col gap-6">
        {campaign.status === "APPROVED" && (
          <LaunchPanel
            campaignId={campaign.id}
            failure={startFailure}
            onResult={(failure) => {
              setStartFailure(failure);
              reload();
            }}
          />
        )}
        <LockedPanel campaign={campaign} approval={campaign.approval} />
      </div>
    );
  }
  if (isFinal(campaign)) return null;
  return (
    <ApprovalPanel
      campaign={campaign}
      proposal={proposal}
      stale={state === "stale"}
      onChanged={reload}
      onStartFailed={setStartFailure}
    />
  );
}

export function CampaignBody({
  campaign,
  timeline,
  planFailure,
  reload,
}: {
  campaign: CampaignView;
  timeline: Resource<TimelineEventView[]>;
  planFailure: string | null;
  reload: () => void;
}) {
  const { proposal } = campaign;
  return (
    <>
      <CampaignHeader campaign={campaign} />
      {proposal !== null && approvalState(campaign) !== "current" && !isFinal(campaign) && (
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-line-strong bg-raised/50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted">
            <span className="font-medium text-ink">Your next step: review and approve.</span> Check
            the copy, each card and the costs below. Nothing starts until you approve.
          </p>
          <a href="#campaign-approval" className={`${secondaryButton} self-start sm:self-auto`}>
            Review and approve
            <HugeiconsIcon icon={ArrowDown01Icon} size={16} aria-hidden />
          </a>
        </div>
      )}
      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-8">
        <div className="flex min-w-0 flex-col gap-16">
          {proposal === null ? (
            <NoProposal campaign={campaign} earlierFailure={planFailure} onPlanned={reload} />
          ) : (
            <CopySection
              campaign={campaign}
              proposal={proposal}
              approved={approvalState(campaign) === "current"}
              editable={isCopyEditable(campaign.status)}
              onSaved={reload}
            />
          )}
          <SpotCards spots={campaign.spots} />
          {proposal !== null && <ProposalDetails campaign={campaign} proposal={proposal} />}
        </div>
        {proposal !== null && (
          <aside
            id="campaign-approval"
            className="scroll-mt-6 xl:sticky xl:top-8 xl:col-start-2 xl:row-start-1 min-[1200px]:flex min-[1200px]:max-h-[calc(100dvh-7rem)] min-[1200px]:flex-col min-[1200px]:overflow-y-auto"
          >
            <ApprovalAside campaign={campaign} proposal={proposal} reload={reload} />
          </aside>
        )}
        <div className="min-w-0 xl:col-start-1">
          <Timeline resource={timeline} />
        </div>
      </div>
    </>
  );
}
