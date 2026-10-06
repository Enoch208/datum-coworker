import type { CampaignView, ProposalView } from "@datum/core";
import { EvidencePanel } from "./evidence-panel";
import { NotesPanel } from "./notes-panel";
import { PlanPanel } from "./plan-panel";

export function ProposalDetails({
  campaign,
  proposal,
}: {
  campaign: CampaignView;
  proposal: ProposalView;
}) {
  return (
    <>
      <PlanPanel campaign={campaign} proposal={proposal} />
      <EvidencePanel policy={proposal.evidencePolicy} deadline={campaign.deadline} />
      <NotesPanel assumptions={proposal.assumptions} warnings={proposal.customerWarnings} />
    </>
  );
}
