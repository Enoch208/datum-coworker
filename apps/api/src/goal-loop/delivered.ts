import { and, eq, inArray } from "drizzle-orm";
import { openTaskStatuses } from "@datum/core";
import {
  evidence,
  expenses,
  physicalTasks,
  runners,
  spots,
  type Db,
  type Executor,
  type PhysicalTaskRow,
  type RunnerRow,
} from "@datum/db";
import { recordAgreedFee } from "../services/agreed-fees";
import { recordAudit } from "../services/audit";
import { lockCampaign } from "../services/status";

export interface OpenTask {
  readonly task: PhysicalTaskRow;
  readonly runner: RunnerRow | null;
  readonly spotCode: string | null;
}

export const openTasks = async (db: Executor, campaignId: string): Promise<OpenTask[]> =>
  db
    .select({ task: physicalTasks, runner: runners, spotCode: spots.code })
    .from(physicalTasks)
    .leftJoin(runners, eq(runners.id, physicalTasks.runnerId))
    .leftJoin(spots, eq(spots.id, physicalTasks.spotId))
    .where(
      and(
        eq(physicalTasks.campaignId, campaignId),
        inArray(physicalTasks.status, [...openTaskStatuses]),
      ),
    );

export type TaskFilter = (open: OpenTask) => boolean;

async function proofOf(db: Executor, task: PhysicalTaskRow): Promise<string | null> {
  if (task.type === "PLACE_SPOT") {
    const [passed] = await db
      .select({ id: evidence.id })
      .from(evidence)
      .where(and(eq(evidence.physicalTaskId, task.id), eq(evidence.verdict, "PASS")));
    return passed?.id ?? null;
  }
  const [confirmed] = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(and(eq(expenses.physicalTaskId, task.id), eq(expenses.status, "CONFIRMED")));
  return confirmed?.id ?? null;
}

export const hasProof = async (db: Executor, task: PhysicalTaskRow): Promise<boolean> =>
  (await proofOf(db, task)) !== null;

async function closeDelivered(db: Executor, open: OpenTask, now: Date): Promise<void> {
  const { task } = open;
  const proofId = await proofOf(db, task);
  if (proofId === null) return;
  const [closed] = await db
    .update(physicalTasks)
    .set({ status: "COMPLETED", completedAt: now, updatedAt: now })
    .where(and(eq(physicalTasks.id, task.id), inArray(physicalTasks.status, [...openTaskStatuses])))
    .returning();
  if (closed === undefined) return;
  await recordAudit(db, task.campaignId, {
    type: "TASK_COMPLETED",
    payload: {
      taskId: task.id,
      type: task.type,
      spotCode: open.spotCode,
      closedBy: "DATUM",
      proofId,
    },
  });
  if (closed.type === "PLACE_SPOT") await recordAgreedFee(db, closed);
}

export async function closeDeliveredTasks(
  db: Db,
  campaignId: string,
  now: Date,
  select: TaskFilter,
): Promise<void> {
  if (!(await openTasks(db, campaignId)).some(select)) return;
  await db.transaction(async (tx) => {
    await lockCampaign(tx, campaignId);
    for (const open of (await openTasks(tx, campaignId)).filter(select)) {
      await closeDelivered(tx, open, now);
    }
  });
}

export const overdueAt =
  (now: Date): TaskFilter =>
  ({ task }) =>
    task.dueBy.getTime() < now.getTime();

export const runnerGone =
  (now: Date): TaskFilter =>
  ({ task, runner }) =>
    task.runnerId !== null &&
    (runner === null || !runner.active || runner.tokenExpiresAt.getTime() <= now.getTime());

export const everyTask: TaskFilter = () => true;
