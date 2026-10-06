import { and, eq, inArray, lt } from "drizzle-orm";
import { openTaskStatuses } from "@datum/core";
import {
  evidence,
  expenses,
  physicalTasks,
  spots,
  type Db,
  type Executor,
  type PhysicalTaskRow,
} from "@datum/db";
import { recordAgreedFee } from "../services/agreed-fees";
import { recordAudit } from "../services/audit";
import { lockCampaign } from "../services/status";
import { refreshSpotOutcome } from "../services/spot-outcomes";

export const openTasks = (db: Executor, campaignId: string) =>
  db
    .select()
    .from(physicalTasks)
    .where(
      and(
        eq(physicalTasks.campaignId, campaignId),
        inArray(physicalTasks.status, [...openTaskStatuses]),
      ),
    );

export async function closeVerifiedPlacements(
  db: Db,
  campaignId: string,
  now: Date,
  dueBefore: Date | null,
): Promise<void> {
  const isCandidate = (task: PhysicalTaskRow): boolean =>
    task.type === "PLACE_SPOT" &&
    (dueBefore === null || task.dueBy.getTime() < dueBefore.getTime());
  if (!(await openTasks(db, campaignId)).some(isCandidate)) return;
  await db.transaction(async (tx) => {
    await lockCampaign(tx, campaignId);
    for (const task of (await openTasks(tx, campaignId)).filter(isCandidate)) {
      const [passed] = await tx
        .select({ id: evidence.id })
        .from(evidence)
        .where(and(eq(evidence.physicalTaskId, task.id), eq(evidence.verdict, "PASS")));
      if (passed === undefined) continue;
      const [closed] = await tx
        .update(physicalTasks)
        .set({ status: "COMPLETED", completedAt: now, updatedAt: now })
        .where(eq(physicalTasks.id, task.id))
        .returning();
      if (closed === undefined) continue;
      const [spot] = await tx
        .select({ code: spots.code })
        .from(spots)
        .where(eq(spots.id, task.spotId ?? ""));
      await recordAudit(tx, campaignId, {
        type: "TASK_COMPLETED",
        payload: {
          taskId: task.id,
          type: task.type,
          spotCode: spot?.code ?? null,
          closedBy: "DATUM",
          evidenceId: passed.id,
        },
      });
      await recordAgreedFee(tx, closed);
    }
  });
}

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
