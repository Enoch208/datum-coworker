import {
  campaignDetail,
  HttpError,
  planProposal,
  startCampaign,
} from "@datum/api/campaign-service";
import { expireUnstartedCampaign } from "@datum/api/goal-loop";
import { isFinalStatus, type CampaignStatus } from "@datum/core";
import type { CampaignRow, CoworkerTaskRow } from "@datum/db";
import { advance, type LifecycleState } from "@datum/masumi";
import { postOnce, storedComment } from "./comments";
import type { Coworker } from "./context";
import { campaignDeps, paymentJournal, reached } from "./lifecycle";
import { campaignForTask, countPlanAttempt, moveStage, recordEscrowLocked } from "./registry";
import { finishedCampaign, ranPhysicalWork } from "./result";
import { notLaunchedComment, proposalComment } from "./texts";

export type Progress = "MOVED" | "WAITING";

const maxPlanAttempts = 5;

const unplanned: ReadonlySet<CampaignStatus> = new Set(["DRAFT", "PLANNING"]);
const payable: ReadonlySet<CampaignStatus> = new Set(["AWAITING_APPROVAL", "APPROVED"]);

async function linkedCampaign(coworker: Coworker, hire: CoworkerTaskRow): Promise<CampaignRow> {
  const campaign = await campaignForTask(coworker.db, hire.sokosumiTaskId);
  if (campaign === null) {
    throw new Error(`Task ${hire.sokosumiTaskId} has no campaign although its brief was accepted`);
  }
  return campaign;
}

const beforeDeadline = (coworker: Coworker, campaign: CampaignRow): boolean =>
  coworker.clock.now() < campaign.deadline.getTime();

async function plan(coworker: Coworker, hire: CoworkerTaskRow, campaign: CampaignRow) {
  if (hire.planAttempts >= maxPlanAttempts) return;
  try {
    await planProposal(coworker.campaigns, campaign.id);
    coworker.log(`Task ${hire.sokosumiTaskId}: planned campaign ${campaign.id}`);
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    const attempts = await countPlanAttempt(coworker.db, hire);
    coworker.log(
      `Task ${hire.sokosumiTaskId}: planning campaign ${campaign.id} failed (${String(attempts)}/${String(maxPlanAttempts)}): ${error.code} ${error.message}`,
    );
  }
}

async function endNotLaunched(coworker: Coworker, hire: CoworkerTaskRow, campaign: CampaignRow) {
  await postOnce(coworker, {
    sokosumiTaskId: hire.sokosumiTaskId,
    purpose: "ENDED",
    round: 1,
    taskStatus: "FAILED",
    body: notLaunchedComment(campaign.approvedAt !== null, campaign.deadline),
  });
  await moveStage(coworker.db, hire.sokosumiTaskId, {
    stage: "ENDED",
    stopReason: `Campaign ${campaign.id} did not start before its deadline; no result was submitted`,
  });
  coworker.log(`Task ${hire.sokosumiTaskId}: campaign ${campaign.id} never ran; Task ended FAILED`);
}

async function neverRan(coworker: Coworker, campaign: CampaignRow, state: LifecycleState) {
  if (!isFinalStatus(campaign.status) || reached(state, "result_saved")) return false;
  const finished = await finishedCampaign(coworker.db, campaign.id);
  return finished === null || !ranPhysicalWork(finished.receipt);
}

async function proposeOnce(coworker: Coworker, hire: CoworkerTaskRow, campaign: CampaignRow) {
  const key = { sokosumiTaskId: hire.sokosumiTaskId, purpose: "PROPOSAL", round: 1 } as const;
  if ((await storedComment(coworker.db, key))?.eventId != null) return;
  const view = await campaignDetail(coworker.db, coworker.campaigns.appBaseUrl, campaign.id);
  await postOnce(coworker, {
    ...key,
    taskStatus: null,
    body: proposalComment(view, coworker.campaigns.appBaseUrl),
  });
}

async function launchWhenFunded(coworker: Coworker, campaign: CampaignRow, state: LifecycleState) {
  if (!("escrowTxHash" in state)) return;
  const at = new Date(coworker.clock.now());
  if (await recordEscrowLocked(coworker.db, state.taskId, state.escrowTxHash, at)) {
    coworker.log(
      `Task ${state.taskId}: escrow ${state.escrowTxHash} confirmed; campaign may start`,
    );
  }
  if (campaign.status !== "APPROVED" || !beforeDeadline(coworker, campaign)) return;
  try {
    const view = await startCampaign(coworker.campaigns, campaign.id);
    coworker.log(
      `Task ${state.taskId}: approved and funded, campaign ${campaign.id} is ${view.status}`,
    );
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    coworker.log(
      `Task ${state.taskId}: campaign ${campaign.id} cannot start yet: ${error.code} ${error.message}`,
    );
  }
}

export async function campaignStep(
  coworker: Coworker,
  hire: CoworkerTaskRow,
  signal: AbortSignal,
): Promise<Progress> {
  let campaign = await linkedCampaign(coworker, hire);
  if (unplanned.has(campaign.status) && beforeDeadline(coworker, campaign)) {
    await plan(coworker, hire, campaign);
    return "MOVED";
  }
  if (!beforeDeadline(coworker, campaign)) {
    if (await expireUnstartedCampaign(coworker.loop, campaign.id, signal)) {
      coworker.log(
        `Task ${hire.sokosumiTaskId}: campaign ${campaign.id} expired before it started`,
      );
    }
    campaign = await linkedCampaign(coworker, hire);
  }
  const state = await paymentJournal(coworker, hire.sokosumiTaskId);
  if (await neverRan(coworker, campaign, state)) {
    await endNotLaunched(coworker, hire, campaign);
    return "MOVED";
  }
  if (
    state.step === "started" &&
    !(payable.has(campaign.status) && beforeDeadline(coworker, campaign))
  ) {
    return "WAITING";
  }
  await proposeOnce(coworker, hire, campaign);
  const next = await advance(state, campaignDeps(coworker, campaign));
  await launchWhenFunded(coworker, campaign, next);
  if (next.step === "verified") {
    await moveStage(coworker.db, hire.sokosumiTaskId, { stage: "PAID" });
    coworker.log(`Task ${hire.sokosumiTaskId}: seller collection verified; the Task is paid`);
  }
  return next.step === state.step ? "WAITING" : "MOVED";
}
