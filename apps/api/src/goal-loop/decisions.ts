import { and, desc, eq, isNull, max } from "drizzle-orm";
import { remediationDecisions, type Executor, type RemediationDecisionRow } from "@datum/db";

export async function latestRound(db: Executor, campaignId: string): Promise<number> {
  const [row] = await db
    .select({ round: max(remediationDecisions.round) })
    .from(remediationDecisions)
    .where(eq(remediationDecisions.campaignId, campaignId));
  return row?.round ?? 0;
}

export async function pendingDecision(
  db: Executor,
  campaignId: string,
): Promise<RemediationDecisionRow | null> {
  const [row] = await db
    .select()
    .from(remediationDecisions)
    .where(
      and(eq(remediationDecisions.campaignId, campaignId), isNull(remediationDecisions.appliedAt)),
    )
    .orderBy(desc(remediationDecisions.round))
    .limit(1);
  return row ?? null;
}

export async function latestDecision(
  db: Executor,
  campaignId: string,
): Promise<RemediationDecisionRow | null> {
  const [row] = await db
    .select()
    .from(remediationDecisions)
    .where(eq(remediationDecisions.campaignId, campaignId))
    .orderBy(desc(remediationDecisions.round))
    .limit(1);
  return row ?? null;
}

export async function markApplied(db: Executor, decisionId: string): Promise<void> {
  const applied = await db
    .update(remediationDecisions)
    .set({ appliedAt: new Date() })
    .where(and(eq(remediationDecisions.id, decisionId), isNull(remediationDecisions.appliedAt)))
    .returning({ id: remediationDecisions.id });
  if (applied.length === 0) throw new Error(`Decision ${decisionId} was already applied`);
}
