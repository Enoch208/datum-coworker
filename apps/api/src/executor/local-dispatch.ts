import { and, desc, eq, gt } from "drizzle-orm";
import type { ExecutorTaskRef, PhysicalTaskDraft } from "@datum/core";
import {
  physicalTasks,
  runners,
  spots,
  type Executor,
  type PhysicalTaskRow,
  type RunnerRow,
} from "@datum/db";
import { recordAudit } from "../services/audit";

export const localAdapter = "LOCAL_ENROLLED_RUNNER" as const;

export class NoRunnerAvailableError extends Error {
  constructor() {
    super("No enrolled runner has an active, unexpired inbox link");
    this.name = "NoRunnerAvailableError";
  }
}

async function availableRunner(db: Executor): Promise<RunnerRow> {
  const [runner] = await db
    .select()
    .from(runners)
    .where(and(eq(runners.active, true), gt(runners.tokenExpiresAt, new Date())))
    .orderBy(desc(runners.createdAt), desc(runners.id))
    .limit(1);
  if (runner === undefined) throw new NoRunnerAvailableError();
  return runner;
}

async function spotIdFor(db: Executor, draft: PhysicalTaskDraft): Promise<string | null> {
  if (draft.spotCode === null) return null;
  const [spot] = await db
    .select({ id: spots.id })
    .from(spots)
    .where(and(eq(spots.campaignId, draft.campaignId), eq(spots.code, draft.spotCode)));
  if (spot === undefined) {
    throw new Error(`Campaign ${draft.campaignId} has no spot ${draft.spotCode}`);
  }
  return spot.id;
}

async function taskByKey(db: Executor, idempotencyKey: string): Promise<PhysicalTaskRow | null> {
  const [task] = await db
    .select()
    .from(physicalTasks)
    .where(eq(physicalTasks.idempotencyKey, idempotencyKey));
  if (task !== undefined && task.adapter !== localAdapter) {
    throw new Error(`Task ${idempotencyKey} belongs to the ${task.adapter} adapter`);
  }
  return task ?? null;
}

async function insertTask(db: Executor, draft: PhysicalTaskDraft): Promise<void> {
  const runner = await availableRunner(db);
  const [task] = await db
    .insert(physicalTasks)
    .values({
      campaignId: draft.campaignId,
      spotId: await spotIdFor(db, draft),
      type: draft.type,
      adapter: localAdapter,
      attempt: draft.attempt,
      idempotencyKey: draft.idempotencyKey,
      assetVersion: draft.assetVersion,
      copies: draft.copies,
      instructions: draft.instructions,
      assetUrls: draft.assetUrls,
      estimatedCostMinor: draft.estimatedCost.amountMinor,
      committedCostMinor: draft.estimatedCost.amountMinor,
      currency: draft.estimatedCost.currency,
      dueBy: new Date(draft.dueBy),
      runnerId: runner.id,
    })
    .onConflictDoNothing({ target: physicalTasks.idempotencyKey })
    .returning();
  if (task === undefined) return;
  await recordAudit(db, draft.campaignId, {
    type: "TASK_CREATED",
    payload: {
      taskId: task.id,
      type: task.type,
      spotCode: draft.spotCode,
      attempt: task.attempt,
      idempotencyKey: task.idempotencyKey,
      adapter: localAdapter,
      copies: task.copies,
      estimatedCost: draft.estimatedCost,
    },
  });
}

async function dispatch(db: Executor, task: PhysicalTaskRow, spotCode: string | null) {
  const [runner] = await db
    .select()
    .from(runners)
    .where(eq(runners.id, task.runnerId ?? ""));
  if (runner === undefined) throw new Error(`Task ${task.id} has no assigned runner`);
  const now = new Date();
  const [dispatched] = await db
    .update(physicalTasks)
    .set({ status: "DISPATCHED", dispatchedAt: now, updatedAt: now, externalTaskRef: task.id })
    .where(and(eq(physicalTasks.id, task.id), eq(physicalTasks.status, "CREATED")))
    .returning({ id: physicalTasks.id });
  if (dispatched === undefined) return;
  await recordAudit(db, task.campaignId, {
    type: "TASK_DISPATCHED",
    payload: {
      taskId: task.id,
      type: task.type,
      spotCode,
      adapter: localAdapter,
      runnerId: runner.id,
      runnerName: runner.name,
    },
  });
}

export async function createLocalTask(
  db: Executor,
  draft: PhysicalTaskDraft,
): Promise<ExecutorTaskRef> {
  if ((await taskByKey(db, draft.idempotencyKey)) === null) await insertTask(db, draft);
  const task = await taskByKey(db, draft.idempotencyKey);
  if (task === null) throw new Error(`Task ${draft.idempotencyKey} vanished after it was created`);
  if (task.status === "CREATED") await dispatch(db, task, draft.spotCode);
  return { adapter: localAdapter, externalRef: task.id };
}
