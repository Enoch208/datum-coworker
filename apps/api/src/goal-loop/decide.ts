import {
  chosenRecoveries,
  pricedAction,
  remediationGaps,
  standardRecoveryPlan,
  summarizeVerdict,
  validateRemediation,
  type GoalEvaluation,
  type RecoveryTerms,
  type RemediationGaps,
  type RemediationPlan,
  type RemediationVerdict,
} from "@datum/core";
import {
  remediationDecisions,
  type Db,
  type PlannerFailureRecord,
  type RecoveryProposal,
  type RemediationDecisionRow,
} from "@datum/db";
import { conflict } from "../http/errors";
import { PlannerModelError } from "../planner/model";
import { recordAudit } from "../services/audit";
import type { Executable } from "../services/execution-plan";
import type { FallbackCause } from "../services/loop-audit";
import { lockCampaign } from "../services/status";
import type { CampaignParts } from "../views/campaigns";
import type { LoopDeps } from "./deps";
import { remediationAuthority } from "./goal";
import { recoveryPrompt } from "./recovery-prompt";
import { checkedProposal } from "./recovery-schema";
import { latestRound } from "./decisions";

interface PlannerAttempt {
  readonly model: string | null;
  readonly proposal: RecoveryProposal | null;
  readonly failure: PlannerFailureRecord | null;
}

const failureOf = (thrown: unknown): PlannerFailureRecord => {
  if (thrown instanceof PlannerModelError) return { code: thrown.code, detail: thrown.message };
  return { code: "UNEXPECTED", detail: thrown instanceof Error ? thrown.message : String(thrown) };
};

async function askPlanner(
  deps: LoopDeps,
  parts: CampaignParts,
  target: Executable,
  gaps: RemediationGaps,
  now: Date,
): Promise<PlannerAttempt> {
  if (deps.planner === null) return { model: null, proposal: null, failure: null };
  const prompt = recoveryPrompt({
    gaps,
    spots: parts.spots.map(({ spot }) => spot),
    currency: target.lock.budget.currency,
    now: now.toISOString(),
    deadline: target.lock.deadline,
  });
  try {
    const reply = await deps.planner.propose(prompt);
    const checked = checkedProposal(reply.output);
    return typeof checked === "string"
      ? {
          model: reply.model,
          proposal: null,
          failure: { code: "MALFORMED_OUTPUT", detail: checked },
        }
      : { model: reply.model, proposal: checked, failure: null };
  } catch (thrown) {
    return { model: null, proposal: null, failure: failureOf(thrown) };
  }
}

const minuteMs = 60_000;

const proposedPlan = (
  proposal: RecoveryProposal,
  terms: RecoveryTerms,
  now: Date,
): RemediationPlan => ({
  actions: proposal.actions.map((action) =>
    pricedAction(
      action.spotCodes,
      new Date(now.getTime() + action.dueInMinutes * minuteMs).toISOString(),
      terms,
    ),
  ),
});

const fallbackCause = (
  attempt: PlannerAttempt,
  proposalVerdict: RemediationVerdict | null,
): FallbackCause => {
  if (proposalVerdict?.outcome === "REJECTED") {
    return { kind: "REJECTED", reason: proposalVerdict.reason, spotCode: proposalVerdict.spotCode };
  }
  if (attempt.failure !== null) return { kind: "PLANNER_FAILED", ...attempt.failure };
  return { kind: "NO_PLANNER" };
};

interface Decision {
  readonly gaps: RemediationGaps;
  readonly attempt: PlannerAttempt;
  readonly proposalVerdict: RemediationVerdict | null;
  readonly verdict: RemediationVerdict;
  readonly fallbackUsed: boolean;
  readonly notes: readonly string[];
}

async function persistDecision(
  db: Db,
  campaignId: string,
  decision: Decision,
): Promise<RemediationDecisionRow> {
  return db.transaction(async (tx) => {
    const campaign = await lockCampaign(tx, campaignId);
    if (campaign.status !== "REMEDIATING") {
      throw conflict("CONFLICT", `Campaign ${campaignId} left REMEDIATING while Datum planned`);
    }
    const round = (await latestRound(tx, campaignId)) + 1;
    const { verdict, attempt } = decision;
    const [row] = await tx
      .insert(remediationDecisions)
      .values({
        campaignId,
        round,
        gaps: decision.gaps,
        plannerModel: attempt.model,
        proposal: attempt.proposal,
        plannerFailure: attempt.failure,
        proposalVerdict:
          decision.proposalVerdict === null ? null : summarizeVerdict(decision.proposalVerdict),
        fallbackUsed: decision.fallbackUsed,
        verdict: summarizeVerdict(verdict),
        actions:
          verdict.outcome === "ACCEPTED"
            ? chosenRecoveries(campaignId, verdict.actions, decision.notes)
            : [],
      })
      .returning();
    if (row === undefined) throw new Error(`Decision round ${String(round)} was not stored`);
    if (attempt.proposal !== null && attempt.model !== null) {
      await recordAudit(tx, campaignId, {
        type: "REMEDIATION_PROPOSED",
        payload: {
          round,
          model: attempt.model,
          actions: attempt.proposal.actions.map(({ spotCodes, dueInMinutes }) => ({
            spotCodes,
            dueInMinutes,
          })),
          rationale: attempt.proposal.rationale,
        },
      });
    }
    if (decision.fallbackUsed) {
      await recordAudit(tx, campaignId, {
        type: "REMEDIATION_FALLBACK",
        payload: {
          round,
          cause: fallbackCause(attempt, decision.proposalVerdict),
          spotCodes: decision.gaps.missingSpots.map(({ spotCode }) => spotCode),
        },
      });
    }
    return row;
  });
}

export async function decideRecovery(
  deps: LoopDeps,
  parts: CampaignParts,
  target: Executable,
  goal: GoalEvaluation,
  now: Date,
): Promise<RemediationDecisionRow> {
  const authority = remediationAuthority(parts, target, goal, now);
  const gaps = remediationGaps(authority);
  const terms = {
    assetVersion: target.lock.assetVersion,
    ratePerSpot: deps.rates.placementCostPerSpot,
  };
  const attempt = await askPlanner(deps, parts, target, gaps, now);
  const proposalVerdict =
    attempt.proposal === null
      ? null
      : validateRemediation(proposedPlan(attempt.proposal, terms, now), authority);
  const modelPlanStands = proposalVerdict !== null && proposalVerdict.outcome !== "REJECTED";
  const verdict = modelPlanStands
    ? proposalVerdict
    : validateRemediation(standardRecoveryPlan(gaps, target.lock.deadline, terms), authority);
  if (verdict.outcome === "REJECTED") {
    throw new Error(
      `The standard recovery for ${parts.campaign.id} was rejected (${verdict.reason}), so the gaps and the rules disagree`,
    );
  }
  const notes = modelPlanStands
    ? (attempt.proposal?.actions.map((action) => action.runnerNote) ?? [])
    : [];
  return persistDecision(deps.db, parts.campaign.id, {
    gaps,
    attempt,
    proposalVerdict,
    verdict,
    fallbackUsed: !modelPlanStands,
    notes,
  });
}
