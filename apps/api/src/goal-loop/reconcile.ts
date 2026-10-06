import { and, eq, inArray, lt } from "drizzle-orm";
import { openTaskStatuses } from "@datum/core";
import { expenses, physicalTasks, spots, type Executor, type PhysicalTaskRow } from "@datum/db";
import { recordAudit } from "../services/audit";
import { refreshSpotOutcome } from "../services/spot-outcomes";

async function spotCodeOf(db: Executor, task: PhysicalTaskRow): Promise<string | null> {
  if (task.spotId === null) return null;
  const [spot] = await db.select({ code: spots.code }).from(spots).where(eq(spots.id, task.spotId));
  return spot?.code ?? null;
}

async function heldAmount(db: Executor, task: PhysicalTaskRow): Promise<number> {
  const [confirmed] = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(and(eq(expenses.physicalTaskId, task.id), eq(expenses.status, "CONFIRMED")));
  return confirmed === undefined ? task.committedCostMinor : 0;
}

async function recordExpiry(db: Executor, task: PhysicalTaskRow): Promise<void> {
  await recordAudit(db, task.campaignId, {
    type: "TASK_EXPIRED",
    payload: {
      taskId: task.id,
      type: task.type,
      spotCode: await spotCodeOf(db, task),
      attempt: task.attempt,
      released: { amountMinor: await heldAmount(db, task), currency: task.currency },
    },
  });
  if (task.spotId !== null) await refreshSpotOutcome(db, task.spotId);
}

export async function expireOverdueTasks(
  db: Executor,
  campaignId: string,
  now: Date,
): Promise<PhysicalTaskRow[]> {
  return db.transaction(async (tx) => {
    const expired = await tx
      .update(physicalTasks)
      .set({ status: "EXPIRED", updatedAt: now })
      .where(
        and(
          eq(physicalTasks.campaignId, campaignId),
          inArray(physicalTasks.status, [...openTaskStatuses]),
          lt(physicalTasks.dueBy, now),
        ),
      )
      .returning();
    for (const task of expired) await recordExpiry(tx, task);
    return expired;
  });
}
