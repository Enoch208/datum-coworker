import { and, eq } from "drizzle-orm";
import { evenShare, type ChosenRecovery, type Money, type PhysicalTaskDraft } from "@datum/core";
import { spots, type Executor, type RemediationDecisionRow, type SpotRow } from "@datum/db";
import { recordAudit } from "../services/audit";
import { refreshSpotOutcome } from "../services/spot-outcomes";
import { placeInstructions, placementCardUrl, sentence } from "../services/commission";
import { lockCampaign, moveStatus } from "../services/status";
import type { LoopDeps } from "./deps";
import { markApplied } from "./decisions";
import { expireCampaign } from "./finish";

async function spotRow(db: Executor, campaignId: string, spotCode: string): Promise<SpotRow> {
  const [spot] = await db
    .select()
    .from(spots)
    .where(and(eq(spots.campaignId, campaignId), eq(spots.code, spotCode)));
  if (spot === undefined) throw new Error(`Campaign ${campaignId} has no spot ${spotCode}`);
  return spot;
}

const recoveryInstructions = (spot: SpotRow, note: string | null): string =>
  note === null || note.length === 0
    ? placeInstructions(spot)
    : `${placeInstructions(spot)} ${sentence(note)}`;

async function recoveryDrafts(
  deps: LoopDeps,
  campaignId: string,
  assetVersion: number,
  action: ChosenRecovery,
): Promise<PhysicalTaskDraft[]> {
  const share = evenShare(action.estimatedCost, action.tasks.length);
  const drafts: PhysicalTaskDraft[] = [];
  for (const task of action.tasks) {
    const spot = await spotRow(deps.db, campaignId, task.spotCode);
    drafts.push({
      campaignId,
      spotCode: task.spotCode,
      type: "PLACE_SPOT",
      attempt: task.attempt,
      idempotencyKey: task.idempotencyKey,
      copies: null,
      assetVersion,
      instructions: recoveryInstructions(spot, action.runnerNote),
      assetUrls: [placementCardUrl(deps.appBaseUrl, campaignId, assetVersion, task.spotCode)],
      estimatedCost: share,
      dueBy: action.dueBy,
    });
  }
  return drafts;
}

const remainingBefore = (decision: RemediationDecisionRow, currency: Money["currency"]): Money => ({
  amountMinor: decision.gaps.remainingBudgetMinor,
  currency,
});

async function dispatchAccepted(
  deps: LoopDeps,
  decision: RemediationDecisionRow,
  assetVersion: number,
  currency: Money["currency"],
  signal: AbortSignal,
): Promise<void> {
  const campaignId = decision.campaignId;
  for (const action of decision.actions) {
    for (const draft of await recoveryDrafts(deps, campaignId, assetVersion, action)) {
      signal.throwIfAborted();
      await deps.executor.createTask(draft);
    }
  }
  signal.throwIfAborted();
  await deps.db.transaction(async (tx) => {
    await lockCampaign(tx, campaignId);
    await markApplied(tx, decision.id);
    for (const action of decision.actions) {
      await recordAudit(tx, campaignId, {
        type: "RECOVERY_CREATED",
        payload: {
          round: decision.round,
          source: decision.fallbackUsed ? "FALLBACK" : "MODEL",
          idempotencyKey: action.idempotencyKey,
          spotCodes: action.spotCodes,
          tasks: action.tasks,
          estimatedCost: action.estimatedCost,
          remainingBefore: remainingBefore(decision, currency),
          minutesToDeadline: decision.gaps.minutesToDeadline,
          dueBy: action.dueBy,
        },
      });
    }
    for (const action of decision.actions) {
      for (const task of action.tasks) {
        await refreshSpotOutcome(tx, (await spotRow(tx, campaignId, task.spotCode)).id);
      }
    }
    await moveStatus(tx, campaignId, "REMEDIATING", "EXECUTING");
  });
}

async function stopForApproval(
  deps: LoopDeps,
  decision: RemediationDecisionRow,
  budget: Money,
): Promise<void> {
  const { verdict, campaignId } = decision;
  if (verdict.planCost === null || verdict.shortfall === null || verdict.revisedMaximum === null) {
    throw new Error(`Decision ${decision.id} needs approval but has no amounts`);
  }
  const { planCost, shortfall, revisedMaximum } = verdict;
  await deps.db.transaction(async (tx) => {
    await lockCampaign(tx, campaignId);
    await markApplied(tx, decision.id);
    await moveStatus(tx, campaignId, "REMEDIATING", "NEEDS_APPROVAL");
    await recordAudit(tx, campaignId, {
      type: "APPROVAL_REQUESTED",
      payload: {
        reason: "RECOVERY_OVER_BUDGET",
        spotCodes: decision.gaps.missingSpots.map(({ spotCode }) => spotCode),
        planCost,
        remaining: remainingBefore(decision, budget.currency),
        budget,
        shortfall,
        revisedMaximum,
      },
    });
  });
}

export interface ApplyContext {
  readonly assetVersion: number;
  readonly budget: Money;
}

export async function applyDecision(
  deps: LoopDeps,
  decision: RemediationDecisionRow,
  context: ApplyContext,
  signal: AbortSignal,
): Promise<void> {
  switch (decision.verdict.outcome) {
    case "ACCEPTED":
      return dispatchAccepted(
        deps,
        decision,
        context.assetVersion,
        context.budget.currency,
        signal,
      );
    case "NEEDS_APPROVAL":
      return stopForApproval(deps, decision, context.budget);
    case "EXPIRED":
      return expireCampaign(deps, decision.campaignId, signal, decision.id);
    case "REJECTED":
      throw new Error(
        `Decision ${decision.id} was stored as rejected (${String(decision.verdict.reason)}); a rejected plan is never applied`,
      );
  }
}
