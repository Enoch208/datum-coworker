import { Link, useLocation, useParams } from "react-router";
import { CampaignBody } from "@/components/campaign/campaign-body";
import { CampaignSkeleton } from "@/components/campaign/campaign-skeleton";
import { secondaryButton } from "@/components/feedback/buttons";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { LiveCampaign } from "@/components/live/live-campaign";
import { hasStarted } from "@/lib/campaign-phase";
import { ApiRequestError } from "@/lib/http";
import { readPlanHandoff } from "@/lib/plan-handoff";
import { appRoutes } from "@/lib/routes";
import { useCampaignScreen } from "@/lib/use-campaign-screen";
import { useDocumentTitle } from "@/lib/use-document-title";

function MissingCampaign({ message }: { message: string }) {
  return (
    <section className="max-w-xl">
      <h1 className="text-4xl font-medium tracking-tight">No campaign here</h1>
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
  const { campaign, timeline, goal, reload } = useCampaignScreen(campaignId);
  useDocumentTitle(campaign.data === null ? "Campaign" : `${campaign.data.brand.name} campaign`);

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
  if (hasStarted(campaign.data)) {
    return (
      <LiveCampaign
        campaign={campaign.data}
        fetchedAt={campaign.updatedAt}
        stale={campaign.error !== null}
        timeline={timeline}
        goal={goal}
        reload={reload}
      />
    );
  }
  return (
    <CampaignBody
      campaign={campaign.data}
      timeline={timeline}
      planFailure={readPlanHandoff(location.state)}
      reload={reload}
    />
  );
}
