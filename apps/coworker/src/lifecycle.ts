import {
  createDbEvidenceStore,
  openLifecycle,
  type LifecycleDeps,
  type LifecycleState,
} from "@datum/masumi";
import type { CampaignRow } from "@datum/db";
import type { Coworker } from "./context";
import { campaignResult } from "./result";
import { campaignSchedule } from "./schedule";

const stepOrder = [
  "new",
  "started",
  "terms_requested",
  "payment_attached",
  "funds_locked",
  "result_saved",
  "result_submitted",
  "result_confirmed",
  "task_completed",
  "collected",
  "verified",
] as const satisfies readonly LifecycleState["step"][];

export const reached = (state: LifecycleState, step: LifecycleState["step"]): boolean =>
  stepOrder.indexOf(state.step) >= stepOrder.indexOf(step);

const baseDeps = (coworker: Coworker): Omit<LifecycleDeps, "evidence" | "produceResult"> => ({
  core: coworker.core,
  mps: coworker.mps,
  chain: coworker.chain,
  journal: coworker.journal,
  clock: coworker.clock,
  config: coworker.config,
  log: coworker.log,
});

export const intakeDeps = (coworker: Coworker): LifecycleDeps => ({
  ...baseDeps(coworker),
  evidence: createDbEvidenceStore(coworker.db),
  produceResult: () => null,
});

export const campaignDeps = (coworker: Coworker, campaign: CampaignRow): LifecycleDeps => ({
  ...baseDeps(coworker),
  evidence: createDbEvidenceStore(coworker.db, campaign.id),
  schedule: (nowMs) => campaignSchedule(nowMs, campaign.deadline),
  produceResult: () => campaignResult(coworker.db, campaign.id, coworker.campaigns.appBaseUrl),
});

export async function paymentJournal(coworker: Coworker, taskId: string): Promise<LifecycleState> {
  const state = await openLifecycle(taskId, {
    journal: coworker.journal,
    clock: coworker.clock,
    log: () => undefined,
  });
  if (state.step === "new" && state.history.length === 1) {
    coworker.log(`Task ${taskId}: payment journal opened with purchaser nonce ${state.nonce}`);
  }
  return state;
}
