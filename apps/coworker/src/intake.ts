import { insertCampaign, type CreateCampaignInput } from "@datum/api/campaign-service";
import type { CoworkerTaskRow } from "@datum/db";
import type { Task } from "@datum/masumi";
import { checkBrief } from "./brief/check";
import { readBrief } from "./brief/read";
import { postRecorded, recordIntent } from "./comments";
import type { Coworker } from "./context";
import { campaignForTask, moveStage } from "./registry";
import { inputRequestComment } from "./texts";

const customerReplies = (task: Task, coworkerId: string): string[] =>
  task.events
    .filter((event) => event.actor?.id !== coworkerId && typeof event.comment === "string")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((event) => event.comment ?? "")
    .filter((comment) => comment.trim().length > 0);

async function createCampaign(coworker: Coworker, taskId: string, input: CreateCampaignInput) {
  const campaignId = await coworker.db.transaction(async (tx) => {
    const existing = await campaignForTask(tx, taskId);
    const id =
      existing?.id ?? (await insertCampaign(tx, coworker.campaigns.appBaseUrl, input, taskId));
    await moveStage(tx, taskId, { stage: "CAMPAIGN" });
    return id;
  });
  coworker.log(`Task ${taskId}: the brief is complete; created campaign ${campaignId}`);
}

async function askForDetails(
  coworker: Coworker,
  hire: CoworkerTaskRow,
  missing: readonly string[],
): Promise<void> {
  const key = {
    sokosumiTaskId: hire.sokosumiTaskId,
    purpose: "INPUT_REQUEST",
    round: hire.inputRequests + 1,
  } as const;
  await coworker.db.transaction(async (tx) => {
    await recordIntent(tx, {
      ...key,
      taskStatus: "INPUT_REQUIRED",
      body: inputRequestComment(missing, key.round),
    });
    await moveStage(tx, hire.sokosumiTaskId, { stage: "NEEDS_INPUT", inputRequests: key.round });
  });
  coworker.log(
    `Task ${hire.sokosumiTaskId}: the brief is missing ${String(missing.length)} detail(s)`,
  );
  await postRecorded(coworker, key);
}

export async function readTaskBrief(coworker: Coworker, hire: CoworkerTaskRow): Promise<void> {
  const task = await coworker.core.task(hire.sokosumiTaskId);
  if (task.status === "READY") {
    await coworker.core.postEvent(task.id, { status: "RUNNING" });
    coworker.log(`Task ${task.id}: back to RUNNING to read the customer's answer`);
    return;
  }
  if (task.status !== "RUNNING") {
    await moveStage(coworker.db, task.id, {
      stage: "ENDED",
      stopReason: `The Task became ${task.status} before Datum finished reading its brief`,
    });
    coworker.log(`Task ${task.id} is ${task.status}; Datum stopped working on it`);
    return;
  }
  if (coworker.briefModel === null) {
    coworker.log(`Task ${task.id}: waiting, because the AI planner is not configured`);
    return;
  }
  const reading = await readBrief(coworker.briefModel, {
    taskName: task.name,
    description: task.description,
    replies: customerReplies(task, coworker.coworkerId),
    now: new Date(coworker.clock.now()).toISOString(),
  });
  const check = checkBrief(reading.brief);
  if (check.kind === "COMPLETE") {
    await createCampaign(coworker, task.id, check.input);
    return;
  }
  await askForDetails(coworker, hire, check.missing);
}

export async function awaitAnswer(
  coworker: Coworker,
  hire: CoworkerTaskRow,
  readyIds: ReadonlySet<string>,
): Promise<void> {
  await postRecorded(coworker, {
    sokosumiTaskId: hire.sokosumiTaskId,
    purpose: "INPUT_REQUEST",
    round: hire.inputRequests,
  });
  if (!readyIds.has(hire.sokosumiTaskId)) return;
  await moveStage(coworker.db, hire.sokosumiTaskId, { stage: "INTAKE" });
  coworker.log(`Task ${hire.sokosumiTaskId} is READY again; reading the brief with the answer`);
}
