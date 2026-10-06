import { asc, eq, inArray, isNull, and } from "drizzle-orm";
import {
  campaigns,
  coworkerTasks,
  type CampaignRow,
  type CoworkerTaskRow,
  type CoworkerTaskStage,
  type Executor,
} from "@datum/db";

const workingStages = [
  "INTAKE",
  "NEEDS_INPUT",
  "CAMPAIGN",
] as const satisfies readonly CoworkerTaskStage[];

export async function takeTask(db: Executor, sokosumiTaskId: string): Promise<boolean> {
  const taken = await db
    .insert(coworkerTasks)
    .values({ sokosumiTaskId })
    .onConflictDoNothing()
    .returning({ id: coworkerTasks.sokosumiTaskId });
  return taken.length === 1;
}

export async function knownTaskIds(db: Executor): Promise<Set<string>> {
  const rows = await db.select({ id: coworkerTasks.sokosumiTaskId }).from(coworkerTasks);
  return new Set(rows.map((row) => row.id));
}

export function workingTasks(db: Executor): Promise<CoworkerTaskRow[]> {
  return db
    .select()
    .from(coworkerTasks)
    .where(inArray(coworkerTasks.stage, [...workingStages]))
    .orderBy(asc(coworkerTasks.createdAt), asc(coworkerTasks.sokosumiTaskId));
}

type StageChange =
  | {
      readonly stage: "INTAKE" | "NEEDS_INPUT" | "CAMPAIGN" | "PAID";
      readonly inputRequests?: number;
    }
  | { readonly stage: "ENDED" | "STOPPED"; readonly stopReason: string };

export async function moveStage(
  db: Executor,
  sokosumiTaskId: string,
  change: StageChange,
): Promise<void> {
  await db
    .update(coworkerTasks)
    .set({ ...change, updatedAt: new Date() })
    .where(eq(coworkerTasks.sokosumiTaskId, sokosumiTaskId));
}

export async function countPlanAttempt(db: Executor, row: CoworkerTaskRow): Promise<number> {
  const attempts = row.planAttempts + 1;
  await db
    .update(coworkerTasks)
    .set({ planAttempts: attempts, updatedAt: new Date() })
    .where(eq(coworkerTasks.sokosumiTaskId, row.sokosumiTaskId));
  return attempts;
}

export async function recordEscrowLocked(
  db: Executor,
  sokosumiTaskId: string,
  escrowTxHash: string,
  at: Date,
): Promise<boolean> {
  const updated = await db
    .update(coworkerTasks)
    .set({ escrowTxHash, fundsLockedAt: at, updatedAt: at })
    .where(
      and(eq(coworkerTasks.sokosumiTaskId, sokosumiTaskId), isNull(coworkerTasks.fundsLockedAt)),
    )
    .returning({ id: coworkerTasks.sokosumiTaskId });
  return updated.length === 1;
}

export async function campaignForTask(
  db: Executor,
  sokosumiTaskId: string,
): Promise<CampaignRow | null> {
  const [row] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.sokosumiTaskId, sokosumiTaskId));
  return row ?? null;
}
