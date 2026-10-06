import { useCallback } from "react";
import { Link, useLocation, useParams } from "react-router";
import { CampaignBody } from "@/components/campaign/campaign-body";
import { CampaignSkeleton } from "@/components/campaign/campaign-skeleton";
import { secondaryButton } from "@/components/feedback/buttons";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { getCampaign, getTimeline } from "@/lib/api-client";
import { ApiRequestError } from "@/lib/http";
import { readPlanHandoff } from "@/lib/plan-handoff";
import { appRoutes } from "@/lib/routes";
import { useDocumentTitle } from "@/lib/use-document-title";
import { usePoll, useResource } from "@/lib/use-resource";

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

export function CampaignPage() {
  const { campaignId = "" } = useParams();
  const location = useLocation();
  const load = useCallback((signal: AbortSignal) => getCampaign(campaignId, signal), [campaignId]);
  const loadTimeline = useCallback(
    (signal: AbortSignal) => getTimeline(campaignId, signal),
    [campaignId],
  );
  const campaign = useResource(`campaign:${campaignId}`, load);
  const timeline = useResource(`timeline:${campaignId}`, loadTimeline);
  const { reload: reloadCampaign } = campaign;
  const { reload: reloadTimeline } = timeline;
  const reload = useCallback(() => {
    reloadCampaign();
    reloadTimeline();
  }, [reloadCampaign, reloadTimeline]);
  useDocumentTitle(campaign.data === null ? "Campaign" : `${campaign.data.brand.name} campaign`);
  usePoll(campaign.data?.status === "PLANNING", 3000, !campaign.pending, reload);

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
      timeline={timeline}
      planFailure={readPlanHandoff(location.state)}
      reload={reload}
    />
  );
}
