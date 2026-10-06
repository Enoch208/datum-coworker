import { eq } from "drizzle-orm";
import type { CampaignStatus } from "@datum/core";
import { campaigns } from "@datum/db";
import { settleCompletedPlacements } from "../services/agreed-fees";
import { campaignParts } from "../services/campaigns";
import { executableOf } from "../services/execution-plan";
import { refreshCampaignSpots } from "../services/spot-outcomes";
import { moveStatus } from "../services/status";
import { applyDecision } from "./apply";
import { isLoopStatus } from "./claim";
import { decideRecovery } from "./decide";
import { resumeAfterDispute, stopForDispute } from "./disputes";
import { pendingDecision } from "./decisions";
import type { LoopDeps } from "./deps";
import { advanceExecution } from "./execution";
import { completeCampaign, expireCampaign } from "./finish";
import { needsRecovery, recordGaps } from "./gaps";
import { evaluateCampaign } from "./goal";
import { closeDeliveredTasks, overdueAt } from "./delivered";
import { expireOverdueTasks } from "./reconcile";
import { releaseStrandedTasks } from "./stranded";

type Judged = "EXECUTING" | "VERIFYING" | "REMEDIATING";

async function recover(
  deps: LoopDeps,
  campaignId: string,
  from: Judged,
  signal: AbortSignal,
): Promise<void> {
  const parts = await campaignParts(deps.db, campaignId);
  const target = executableOf(parts);
  const now = deps.now();
  const goal = evaluateCampaign(parts, target, now);
  if (from !== "REMEDIATING") await recordGaps(deps.db, campaignId, from, goal);
  signal.throwIfAborted();
  const decision = await decideRecovery(deps, parts, target, goal, now);
  signal.throwIfAborted();
  await applyDecision(
    deps,
    decision,
    { assetVersion: target.lock.assetVersion, budget: target.lock.budget },
    signal,
  );
}

async function judge(
  deps: LoopDeps,
  campaignId: string,
  from: Judged,
  signal: AbortSignal,
): Promise<void> {
  const parts = await campaignParts(deps.db, campaignId);
  const goal = evaluateCampaign(parts, executableOf(parts), deps.now());
  if (goal.complete) {
    await completeCampaign(deps, campaignId, signal);
    return;
  }
  if (!goal.beforeDeadline) {
    await expireCampaign(deps, campaignId, signal);
    return;
  }
  if (needsRecovery(goal)) {
    await recover(deps, campaignId, from, signal);
    return;
  }
  if (from !== "EXECUTING") await moveStatus(deps.db, campaignId, from, "EXECUTING");
}

const deadlinePassed = async (deps: LoopDeps, campaignId: string): Promise<boolean> => {
  const parts = await campaignParts(deps.db, campaignId);
  return deps.now().getTime() > new Date(executableOf(parts).lock.deadline).getTime();
};

async function step(
  deps: LoopDeps,
  campaignId: string,
  status: CampaignStatus,
  signal: AbortSignal,
): Promise<void> {
  switch (status) {
    case "EXECUTING": {
      if (await stopForDispute(deps.db, campaignId)) return;
      if (!(await deadlinePassed(deps, campaignId))) {
        const progress = await advanceExecution(deps, campaignId, signal);
        if (progress !== "PLACEMENTS_OUT") return;
      }
      await judge(deps, campaignId, status, signal);
      return;
    }
    case "VERIFYING":
      await judge(deps, campaignId, status, signal);
      return;
    case "REMEDIATING": {
      const pending = await pendingDecision(deps.db, campaignId);
      if (pending === null) {
        await judge(deps, campaignId, status, signal);
        return;
      }
      if (await deadlinePassed(deps, campaignId)) {
        await expireCampaign(deps, campaignId, signal, pending.id);
        return;
      }
      const target = executableOf(await campaignParts(deps.db, campaignId));
      await applyDecision(
        deps,
        pending,
        { assetVersion: target.lock.assetVersion, budget: target.lock.budget },
        signal,
      );
      return;
    }
    case "NEEDS_APPROVAL":
      if (await deadlinePassed(deps, campaignId)) {
        await expireCampaign(deps, campaignId, signal);
        return;
      }
      await resumeAfterDispute(deps.db, campaignId);
      return;
    default:
      return;
  }
}

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
  const now = deps.now();
  await closeDeliveredTasks(deps.db, campaignId, now, overdueAt(now));
  await expireOverdueTasks(deps.db, campaignId, now);
  await releaseStrandedTasks(deps, campaignId, now, signal);
  await settleCompletedPlacements(deps.db, campaignId);
  await refreshCampaignSpots(deps.db, campaignId);
  signal.throwIfAborted();
  await step(deps, campaignId, campaign.status, signal);
}
