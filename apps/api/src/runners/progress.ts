import { eq } from "drizzle-orm";
import { physicalTasks, type Executor, type RunnerRow } from "@datum/db";
import { conflict } from "../http/errors";
import { recordAudit } from "../services/audit";
import { refreshSpotOutcome } from "../services/spot-outcomes";
import { hasEvidence, isOpenForWork, printReceipts, runnerTask, type RunnerTask } from "./tasks";

const subjectOf = ({ task, spot }: RunnerTask) => ({
  taskId: task.id,
  type: task.type,
  spotCode: spot?.code ?? null,
});

const closedConflict = (target: RunnerTask) =>
  conflict("TASK_CLOSED", `This task is ${target.task.status} and can no longer change`);

export async function acceptTask(db: Executor, runner: RunnerRow, taskId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const target = await runnerTask(tx, runner, taskId, true);
    if (target.task.status !== "DISPATCHED") {
      if (isOpenForWork(target.task) || target.task.status === "COMPLETED") return;
      throw closedConflict(target);
    }
    const now = new Date();
    await tx
      .update(physicalTasks)
      .set({ status: "ACCEPTED", acceptedAt: now, updatedAt: now })
      .where(eq(physicalTasks.id, taskId));
    await recordAudit(tx, target.task.campaignId, {
      type: "TASK_ACCEPTED",
      payload: { ...subjectOf(target), runnerName: runner.name },
    });
  });
}

async function assertReceiptConfirmed(db: Executor, taskId: string): Promise<void> {
  const receipts = await printReceipts(db, taskId);
  if (receipts.some((receipt) => receipt.status === "CONFIRMED")) return;
  if (receipts.some((receipt) => receipt.status === "SUBMITTED")) {
    throw conflict(
      "RECEIPT_IN_REVIEW",
      "The print receipt is waiting for review, so the print run cannot be finished yet",
    );
  }
  const disputed = receipts.at(-1);
  if (disputed === undefined) {
    throw conflict("RECEIPT_REQUIRED", "Upload the print receipt and amount before finishing");
  }
  throw conflict(
    "RECEIPT_DISPUTED",
    `The print receipt was not accepted: ${disputed.explanation} Upload a correct receipt before finishing`,
  );
}

async function assertDeliverable(db: Executor, target: RunnerTask): Promise<void> {
  if (target.task.type === "PLACE_SPOT" && !(await hasEvidence(db, target.task.id))) {
    throw conflict("EVIDENCE_REQUIRED", "Upload a photo of the placed card before finishing");
  }
  if (target.task.type === "PRINT_AND_COLLECT") await assertReceiptConfirmed(db, target.task.id);
}

export async function completeTask(db: Executor, runner: RunnerRow, taskId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const target = await runnerTask(tx, runner, taskId, true);
    if (target.task.status === "COMPLETED") return;
    if (target.task.status === "DISPATCHED") {
      throw conflict("TASK_NOT_ACCEPTED", "Accept this task before finishing it");
    }
    if (!isOpenForWork(target.task)) throw closedConflict(target);
    await assertDeliverable(tx, target);
    const now = new Date();
    await tx
      .update(physicalTasks)
      .set({ status: "COMPLETED", completedAt: now, updatedAt: now })
      .where(eq(physicalTasks.id, taskId));
    await recordAudit(tx, target.task.campaignId, {
      type: "TASK_COMPLETED",
      payload: { ...subjectOf(target), runnerName: runner.name },
    });
    if (target.spot !== null) await refreshSpotOutcome(tx, target.spot.id);
  });
}
