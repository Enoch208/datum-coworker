import type { CampaignStatus } from "@datum/core";
import { recordAudit } from "../services/audit";
import { campaignParts } from "../services/campaigns";
import { executableOf } from "../services/execution-plan";
import { refreshCampaignSpots } from "../services/spot-outcomes";
import { lockCampaign, moveThrough } from "../services/status";
import type { LoopDeps } from "./deps";
import { markApplied } from "./decisions";
import { goalEvaluated } from "./gaps";
import { evaluateCampaign } from "./goal";
import { closeDeliveredTasks, everyTask, openTasks } from "./delivered";

const pathToCompleted: Partial<Record<CampaignStatus, CampaignStatus[]>> = {
  EXECUTING: ["EXECUTING", "VERIFYING", "COMPLETED"],
  VERIFYING: ["VERIFYING", "COMPLETED"],
  REMEDIATING: ["REMEDIATING", "EXECUTING", "VERIFYING", "COMPLETED"],
};

async function cancelOpenTasks(deps: LoopDeps, campaignId: string, signal: AbortSignal) {
  for (const { task } of await openTasks(deps.db, campaignId)) {
    signal.throwIfAborted();
    await deps.executor.cancelTask({ adapter: task.adapter, externalRef: task.id });
  }
}

export async function completeCampaign(
  deps: LoopDeps,
  campaignId: string,
  signal: AbortSignal,
): Promise<boolean> {
  await closeDeliveredTasks(deps.db, campaignId, deps.now(), everyTask);
  await cancelOpenTasks(deps, campaignId, signal);
  signal.throwIfAborted();
  return deps.db.transaction(async (tx) => {
    const campaign = await lockCampaign(tx, campaignId);
    const path = pathToCompleted[campaign.status];
    if (path === undefined) return false;
    const parts = await campaignParts(tx, campaignId);
    const goal = evaluateCampaign(parts, executableOf(parts), deps.now());
    if (!goal.complete || goal.completedAt === null) return false;
    await recordAudit(tx, campaignId, goalEvaluated(goal));
    await moveThrough(tx, campaignId, path, { completedAt: new Date(goal.completedAt) });
    return true;
  });
}

export async function expireCampaign(
  deps: LoopDeps,
  campaignId: string,
  signal: AbortSignal,
  decisionId: string | null = null,
): Promise<void> {
  await cancelOpenTasks(deps, campaignId, signal);
  await refreshCampaignSpots(deps.db, campaignId);
  signal.throwIfAborted();
  await deps.db.transaction(async (tx) => {
    const campaign = await lockCampaign(tx, campaignId);
    if (decisionId !== null) await markApplied(tx, decisionId);
    const parts = await campaignParts(tx, campaignId);
    const goal = evaluateCampaign(parts, executableOf(parts), deps.now());
    await recordAudit(tx, campaignId, goalEvaluated(goal));
    await moveThrough(tx, campaignId, [campaign.status, "EXPIRED_INCOMPLETE"]);
  });
}
