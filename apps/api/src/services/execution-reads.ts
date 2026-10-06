import { asc, eq } from "drizzle-orm";
import {
  evidence,
  expenses,
  physicalTasks,
  spots,
  type EvidenceRow,
  type ExpenseRow,
  type Executor,
  type PhysicalTaskRow,
} from "@datum/db";

export interface TaskWithSpot {
  readonly task: PhysicalTaskRow;
  readonly spotCode: string | null;
}

export async function campaignTasks(db: Executor, campaignId: string): Promise<TaskWithSpot[]> {
  return db
    .select({ task: physicalTasks, spotCode: spots.code })
    .from(physicalTasks)
    .leftJoin(spots, eq(spots.id, physicalTasks.spotId))
    .where(eq(physicalTasks.campaignId, campaignId))
    .orderBy(asc(physicalTasks.createdAt), asc(physicalTasks.idempotencyKey));
}

export async function campaignExpenses(db: Executor, campaignId: string): Promise<ExpenseRow[]> {
  return db
    .select()
    .from(expenses)
    .where(eq(expenses.campaignId, campaignId))
    .orderBy(asc(expenses.createdAt), asc(expenses.id));
}

export async function campaignEvidence(db: Executor, campaignId: string): Promise<EvidenceRow[]> {
  const rows = await db
    .select({ evidence })
    .from(evidence)
    .innerJoin(physicalTasks, eq(physicalTasks.id, evidence.physicalTaskId))
    .where(eq(physicalTasks.campaignId, campaignId))
    .orderBy(asc(evidence.submittedAt), asc(evidence.id));
  return rows.map((row) => row.evidence);
}
