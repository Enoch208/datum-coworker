import { asc, eq } from "drizzle-orm";
import type { InterventionAction, InterventionActor } from "@datum/core";
import { interventions, type Executor, type InterventionRow } from "@datum/db";
import { recordAudit } from "./audit";

export interface InterventionInput {
  readonly campaignId: string;
  readonly actor: InterventionActor;
  readonly actorName: string;
  readonly action: InterventionAction;
  readonly reason: string;
  readonly ownerStatement?: string;
  readonly ownerSignature?: string;
}

export async function recordIntervention(db: Executor, input: InterventionInput): Promise<void> {
  const [row] = await db.insert(interventions).values(input).returning();
  if (row === undefined) throw new Error("Recording an intervention returned no row");
  await recordAudit(db, input.campaignId, {
    type: "INTERVENTION_RECORDED",
    payload: {
      interventionId: row.id,
      actor: row.actor,
      actorName: row.actorName,
      action: row.action,
      reason: row.reason,
    },
  });
}

export const campaignInterventions = (
  db: Executor,
  campaignId: string,
): Promise<InterventionRow[]> =>
  db
    .select()
    .from(interventions)
    .where(eq(interventions.campaignId, campaignId))
    .orderBy(asc(interventions.createdAt), asc(interventions.id));
