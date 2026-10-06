import type { CampaignView, ProposalView, TimelineEventView } from "@datum/core";
import { ApprovalPanel } from "@/components/approval/approval-panel";
import { approvalState, isFinal } from "@/components/approval/approval-state";
import { LockedPanel } from "@/components/approval/locked-panel";
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
  const state = approvalState(campaign);
  if (state === "current" && campaign.approval !== null) {
    return <LockedPanel campaign={campaign} approval={campaign.approval} />;
  }
  if (isFinal(campaign)) return null;
  return (
    <ApprovalPanel
      campaign={campaign}
      proposal={proposal}
      stale={state === "stale"}
      onChanged={reload}
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
      <div className="mt-16 grid items-start gap-16 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_23rem] xl:gap-16">
        <div className="flex min-w-0 flex-col gap-16">
          {proposal === null ? (
            <NoProposal campaign={campaign} earlierFailure={planFailure} onPlanned={reload} />
          ) : (
            <CopySection
              campaign={campaign}
              proposal={proposal}
              approved={approvalState(campaign) === "current"}
              editable={!isFinal(campaign)}
              onSaved={reload}
            />
          )}
          <SpotCards spots={campaign.spots} />
          {proposal !== null && <ProposalDetails campaign={campaign} proposal={proposal} />}
        </div>
        {proposal !== null && (
          <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1">
            <ApprovalAside campaign={campaign} proposal={proposal} reload={reload} />
          </aside>
        )}
        <div className="min-w-0 lg:col-start-1">
          <Timeline resource={timeline} />
        </div>
      </div>
    </>
  );
}
