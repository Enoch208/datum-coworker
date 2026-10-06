import { and, eq, inArray } from "drizzle-orm";
import {
  estimatePlan,
  openTaskStatuses,
  type CancelResult,
  type CostRates,
  type ExecutorEvidence,
  type ExecutorTaskRef,
  type ExecutorTaskState,
  type Money,
  type PhysicalExecutor,
  type PhysicalTaskDraft,
  type PlanStepDraft,
} from "@datum/core";
import {
  evidence,
  expenses,
  physicalTasks,
  spots,
  type Executor,
  type PhysicalTaskRow,
} from "@datum/db";
import { recordAudit } from "../services/audit";
import { refreshSpotOutcome } from "../services/spot-outcomes";
import { evidenceFileUrl } from "../uploads/files";
import { createLocalTask, localAdapter } from "./local-dispatch";

export interface LocalRunnerOptions {
  readonly db: Executor;
  readonly appBaseUrl: string;
  readonly rates: CostRates;
}

const planStep = (draft: PhysicalTaskDraft): PlanStepDraft => {
  if (draft.type === "PLACE_SPOT") {
    if (draft.spotCode === null) throw new RangeError("A placement draft needs a spot code");
    return { type: "PLACE_SPOT", spotCode: draft.spotCode };
  }
  if (draft.copies === null) throw new RangeError("A print draft needs a copy count");
  return { type: "PRINT_AND_COLLECT", quantity: draft.copies };
};

const estimateDraft = (draft: PhysicalTaskDraft, rates: CostRates): Money =>
  estimatePlan([planStep(draft)], rates, draft.estimatedCost.currency).total;

async function localTask(db: Executor, ref: ExecutorTaskRef): Promise<PhysicalTaskRow> {
  if (ref.adapter !== localAdapter) {
    throw new Error(`The local runner cannot read a ${ref.adapter} task`);
  }
  const [task] = await db.select().from(physicalTasks).where(eq(physicalTasks.id, ref.externalRef));
  if (task === undefined) throw new Error(`No local task ${ref.externalRef}`);
  return task;
}

const taskState = (task: PhysicalTaskRow): ExecutorTaskState => ({
  status: task.status,
  updatedAt: task.updatedAt.toISOString(),
});

async function spotCodeOf(db: Executor, task: PhysicalTaskRow): Promise<string | null> {
  if (task.spotId === null) return null;
  const [spot] = await db.select({ code: spots.code }).from(spots).where(eq(spots.id, task.spotId));
  return spot?.code ?? null;
}

async function localEvidence(
  db: Executor,
  appBaseUrl: string,
  task: PhysicalTaskRow,
): Promise<ExecutorEvidence[]> {
  const spotCode = await spotCodeOf(db, task);
  const photos = await db.select().from(evidence).where(eq(evidence.physicalTaskId, task.id));
  const receipts = await db.select().from(expenses).where(eq(expenses.physicalTaskId, task.id));
  const empty = { claimedAmount: null, receiptUrl: null, optionalGeo: null };
  return [
    ...photos.map((photo) => ({
      ...empty,
      uploadId: photo.id,
      contentHash: photo.contentHash,
      photoUrl: evidenceFileUrl(appBaseUrl, photo.photoFile),
      submittedAt: photo.submittedAt.toISOString(),
      claimedSpotCode: spotCode,
      optionalGeo: photo.optionalGeo,
    })),
    ...receipts.map((receipt) => ({
      ...empty,
      uploadId: receipt.id,
      contentHash: receipt.contentHash,
      photoUrl: evidenceFileUrl(appBaseUrl, receipt.receiptFile),
      submittedAt: receipt.createdAt.toISOString(),
      claimedSpotCode: null,
      claimedAmount: { amountMinor: receipt.amountMinor, currency: receipt.currency },
      receiptUrl: evidenceFileUrl(appBaseUrl, receipt.receiptFile),
    })),
  ];
}

async function cancelLocalTask(db: Executor, task: PhysicalTaskRow): Promise<CancelResult> {
  const [cancelled] = await db
    .update(physicalTasks)
    .set({ status: "CANCELLED", updatedAt: new Date() })
    .where(and(eq(physicalTasks.id, task.id), inArray(physicalTasks.status, [...openTaskStatuses])))
    .returning({ id: physicalTasks.id });
  if (cancelled === undefined) return { cancelled: false };
  const spotCode = await spotCodeOf(db, task);
  await recordAudit(db, task.campaignId, {
    type: "TASK_CANCELLED",
    payload: { taskId: task.id, type: task.type, spotCode },
  });
  if (task.spotId !== null) await refreshSpotOutcome(db, task.spotId);
  return { cancelled: true };
}

export function localEnrolledRunner(options: LocalRunnerOptions): PhysicalExecutor {
  const { db, appBaseUrl, rates } = options;
  return {
    adapter: localAdapter,
    estimate: (draft) => Promise.resolve(estimateDraft(draft, rates)),
    createTask: (draft) => db.transaction((tx) => createLocalTask(tx, draft)),
    getTask: async (ref) => taskState(await localTask(db, ref)),
    getEvidence: async (ref) => localEvidence(db, appBaseUrl, await localTask(db, ref)),
    cancelTask: (ref) =>
      db.transaction(async (tx) => cancelLocalTask(tx, await localTask(tx, ref))),
  };
}
