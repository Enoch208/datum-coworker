import { eq } from "drizzle-orm";
import { campaigns } from "@datum/db";
import { isLoopStatus } from "./claim";
import type { LoopDeps } from "./deps";
import { advanceExecution } from "./execution";
import { refreshCampaignSpots } from "../services/spot-outcomes";
import { expireOverdueTasks } from "./reconcile";

export async function tickCampaign(
  deps: LoopDeps,
  campaignId: string,
  signal: AbortSignal,
): Promise<void> {
  const [campaign] = await deps.db
    .select({ status: campaigns.status })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));
  if (campaign === undefined || !isLoopStatus(campaign.status)) return;
  await expireOverdueTasks(deps.db, campaignId, deps.now());
  await refreshCampaignSpots(deps.db, campaignId);
  signal.throwIfAborted();
  if (campaign.status !== "EXECUTING") return;
  await advanceExecution(deps, campaignId, signal);
}
