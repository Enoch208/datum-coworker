import type { CampaignStatus, CampaignView } from "@datum/core";
import { LedgerPanel } from "./ledger-panel";
import { SpotProgress } from "./spot-progress";
import { TaskList } from "./task-list";

export const liveStatuses: readonly CampaignStatus[] = ["EXECUTING", "VERIFYING", "REMEDIATING"];

export const hasStarted = (campaign: CampaignView): boolean =>
  liveStatuses.includes(campaign.status) || campaign.tasks.length > 0;

export function ExecutionSections({ campaign }: { campaign: CampaignView }) {
  return (
    <>
      <SpotProgress spots={campaign.spots} />
      <TaskList tasks={campaign.tasks} />
      <LedgerPanel ledger={campaign.ledger} tasks={campaign.tasks} />
    </>
  );
}
