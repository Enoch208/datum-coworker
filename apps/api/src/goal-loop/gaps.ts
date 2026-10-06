import type { CampaignStatus, GoalEvaluation } from "@datum/core";
import { isMissed } from "@datum/core";
import type { Db } from "@datum/db";
import { recordAudit } from "../services/audit";
import { lockCampaign, moveStatus } from "../services/status";

export const needsRecovery = (goal: GoalEvaluation): boolean =>
  goal.unresolved.length > 0 &&
  goal.unresolved.every((requirement) => isMissed(requirement.reason));

export const goalEvaluated = (goal: GoalEvaluation) =>
  ({
    type: "GOAL_EVALUATED",
    payload: {
      passed: goal.passedSpotCodes.length,
      required: goal.requiredSpotCodes.length,
      passedSpotCodes: goal.passedSpotCodes,
      unresolvedSpotCodes: goal.missingSpotCodes,
      minutesToDeadline: goal.minutesToDeadline,
    },
  }) as const;

export async function recordGaps(
  db: Db,
  campaignId: string,
  from: CampaignStatus,
  goal: GoalEvaluation,
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockCampaign(tx, campaignId);
    if (from !== "VERIFYING") await moveStatus(tx, campaignId, from, "VERIFYING");
    await recordAudit(tx, campaignId, goalEvaluated(goal));
    for (const { spotCode, reason } of goal.unresolved) {
      await recordAudit(tx, campaignId, { type: "GAP_DETECTED", payload: { spotCode, reason } });
    }
    await moveStatus(tx, campaignId, "VERIFYING", "REMEDIATING");
  });
}
