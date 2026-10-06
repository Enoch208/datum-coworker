import type { CampaignView } from "@datum/core";
import { useCallback } from "react";
import { Link, useLocation, useParams } from "react-router";
import { CampaignHeader } from "@/components/campaign/campaign-header";
import { CampaignSkeleton } from "@/components/campaign/campaign-skeleton";
import { NoProposal } from "@/components/campaign/no-proposal";
import { ProposalCopy } from "@/components/campaign/proposal-copy";
import { ProposalDetails } from "@/components/campaign/proposal-sections";
import { SpotCards } from "@/components/campaign/spot-cards";
import { secondaryButton } from "@/components/feedback/buttons";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { ApiRequestError, getCampaign } from "@/lib/api-client";
import { readPlanHandoff } from "@/lib/plan-handoff";
import { appRoutes } from "@/lib/routes";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useRepeat, useResource } from "@/lib/use-resource";

function MissingCampaign({ message }: { message: string }) {
  return (
    <section className="max-w-xl">
      <h1 className="text-4xl font-light tracking-tight">No campaign here</h1>
      <p className="mt-4 text-lg font-light text-muted">{message}</p>
      <Link to={appRoutes.newCampaign} className={`${secondaryButton} mt-8`}>
        Create a campaign
      </Link>
    </section>
  );
}

function CampaignBody({
  campaign,
  planFailure,
  reload,
}: {
  campaign: CampaignView;
  planFailure: string | null;
  reload: () => void;
}) {
  const { proposal } = campaign;
  return (
    <>
      <CampaignHeader campaign={campaign} />
      <div className="mt-16 flex max-w-4xl min-w-0 flex-col gap-16">
        {proposal === null ? (
          <NoProposal campaign={campaign} earlierFailure={planFailure} onPlanned={reload} />
        ) : (
          <ProposalCopy proposal={proposal} />
        )}
        <SpotCards spots={campaign.spots} />
        {proposal !== null && <ProposalDetails campaign={campaign} proposal={proposal} />}
      </div>
    </>
  );
}

export function CampaignPage() {
  const { campaignId = "" } = useParams();
  const location = useLocation();
  const load = useCallback((signal: AbortSignal) => getCampaign(campaignId, signal), [campaignId]);
  const campaign = useResource(`campaign:${campaignId}`, load);
  useDocumentTitle(campaign.data === null ? "Campaign" : `${campaign.data.brand.name} campaign`);
  useRepeat(campaign.data?.status === "PLANNING", 3000, campaign.reload);

  if (campaign.error instanceof ApiRequestError && campaign.error.status === 404) {
    return <MissingCampaign message={campaign.error.message} />;
  }
  if (campaign.error !== null && campaign.data === null) {
    return (
      <ErrorPanel
        title="The campaign could not be loaded"
        message={campaign.error.message}
        onRetry={campaign.reload}
      />
    );
  }
  if (campaign.data === null) return <CampaignSkeleton />;
  return (
    <CampaignBody
      campaign={campaign.data}
      planFailure={readPlanHandoff(location.state)}
      reload={campaign.reload}
    />
  );
}
