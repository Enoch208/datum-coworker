import { rm } from "node:fs/promises";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import type { EvidenceView } from "@datum/core";
import {
  evidence,
  physicalTasks,
  type EvidenceRow,
  type Executor,
  type RunnerRow,
} from "@datum/db";
import type { ApiDeps } from "../deps";
import { conflict } from "../http/errors";
import { runnerTask, type RunnerTask } from "../runners/tasks";
import { recordAudit } from "../services/audit";
import { recordSpotPass } from "../services/spot-outcomes";
import { acceptImage, assertAcceptableImage, contentHashOf } from "../uploads/image";
import { storeImage } from "../uploads/store";
import { toEvidenceView } from "../views/evidence";
import { readQrTexts } from "./qr-reader";
import { isSpotLinkFor, judgePhoto } from "./spot-photo";

export interface SubmittedEvidence {
  readonly view: EvidenceView;
  readonly created: boolean;
}

function assertTakesPhotos({ task }: RunnerTask): void {
  if (task.type !== "PLACE_SPOT") {
    throw conflict("NOT_A_PLACEMENT", "A print run takes a receipt, not a placement photo");
  }
  if (task.status === "DISPATCHED") {
    throw conflict("TASK_NOT_ACCEPTED", "Accept this task before uploading its photo");
  }
  if (task.status === "COMPLETED") {
    throw conflict("TASK_COMPLETED", "This task is already finished");
  }
}

async function existingPhoto(db: Executor, taskId: string, contentHash: string) {
  const [row] = await db
    .select()
    .from(evidence)
    .where(and(eq(evidence.physicalTaskId, taskId), eq(evidence.contentHash, contentHash)));
  return row ?? null;
}

async function recordPhoto(
  deps: ApiDeps,
  runner: RunnerRow,
  taskId: string,
  photo: { contentHash: string; file: string; texts: string[]; receivedAt: Date },
): Promise<EvidenceRow | null> {
  return deps.db.transaction(async (tx) => {
    const target = await runnerTask(tx, runner, taskId, true);
    const spot = target.spot;
    if (spot === null) throw new Error(`Task ${taskId} lost its spot`);
    const judged = judgePhoto(target, photo.texts, photo.receivedAt, deps.appBaseUrl);
    const { evaluation } = judged;
    const [row] = await tx
      .insert(evidence)
      .values({
        physicalTaskId: taskId,
        spotId: spot.id,
        contentHash: photo.contentHash,
        photoFile: photo.file,
        submittedAt: photo.receivedAt,
        decodedCampaignId: evaluation.decoded?.campaignId ?? null,
        decodedSpotCode: evaluation.decoded?.spotCode ?? null,
        checks: evaluation.checks,
        verdict: evaluation.verdict,
        failure: evaluation.failure,
        explanation: judged.explanation,
      })
      .onConflictDoNothing({ target: [evidence.physicalTaskId, evidence.contentHash] })
      .returning();
    if (row === undefined) return null;
    const campaignId = target.task.campaignId;
    await recordAudit(tx, campaignId, {
      type: "EVIDENCE_RECEIVED",
      payload: { evidenceId: row.id, taskId, spotCode: spot.code, runnerName: runner.name },
    });
    await recordAudit(tx, campaignId, {
      type: "EVIDENCE_EVALUATED",
      payload: {
        evidenceId: row.id,
        taskId,
        spotCode: spot.code,
        verdict: evaluation.verdict,
        failure: evaluation.failure,
        explanation: judged.explanation,
      },
    });
    if (target.task.status === "ACCEPTED") {
      await tx
        .update(physicalTasks)
        .set({ status: "SUBMITTED", updatedAt: new Date() })
        .where(eq(physicalTasks.id, taskId));
    }
    if (evaluation.verdict === "PASS") await recordSpotPass(tx, spot.id, target.task.attempt);
    return row;
  });
}

export async function submitEvidence(
  deps: ApiDeps,
  runner: RunnerRow,
  taskId: string,
  bytes: Uint8Array,
): Promise<SubmittedEvidence> {
  const receivedAt = new Date();
  const target = await runnerTask(deps.db, runner, taskId);
  assertTakesPhotos(target);
  assertAcceptableImage(bytes, "photo");
  const contentHash = contentHashOf(bytes);
  const spotCode = target.spot?.code ?? null;
  const known = await existingPhoto(deps.db, taskId, contentHash);
  if (known !== null)
    return { view: toEvidenceView(known, spotCode, deps.appBaseUrl), created: false };
  const image = await acceptImage(bytes, "photo");
  const texts = await readQrTexts(image.pixels, isSpotLinkFor(deps.appBaseUrl));
  const file = await storeImage(deps.evidenceDir, image.jpeg);
  const row = await recordPhoto(deps, runner, taskId, { contentHash, file, texts, receivedAt });
  if (row !== null) return { view: toEvidenceView(row, spotCode, deps.appBaseUrl), created: true };
  await rm(join(deps.evidenceDir, file), { force: true });
  const winner = await existingPhoto(deps.db, taskId, contentHash);
  if (winner === null) throw new Error(`Evidence ${contentHash} for ${taskId} vanished`);
  return { view: toEvidenceView(winner, spotCode, deps.appBaseUrl), created: false };
}
