import type { CoworkerTaskRow } from "@datum/db";
import type { TaskListItem } from "@datum/masumi";
import type { Coworker } from "./context";
import { classifyFailure } from "./failures";
import { withTaskLock } from "./lock";
import { humanIntervalMs, retryIntervalMs, waitingIntervalMs, type Pacing } from "./pacing";
import { knownTaskIds, moveStage, takeTask, workingTasks } from "./registry";
import { stepTask } from "./task-step";

const workspaceOf = (task: TaskListItem): string =>
  task.organizationId === null ? "Personal Workspace" : `organization ${task.organizationId}`;

async function takeNewTasks(
  coworker: Coworker,
  ready: readonly TaskListItem[],
  pacing: Pacing,
): Promise<void> {
  const known = await knownTaskIds(coworker.db);
  for (const task of ready.filter((candidate) => !known.has(candidate.id))) {
    if (coworker.briefModel === null) {
      if (pacing.firstTime(`untaken:${task.id}`)) {
        coworker.log(`Not taking Task ${task.id}: the AI planner is not configured`);
      }
      continue;
    }
    if (await takeTask(coworker.db, task.id)) {
      coworker.log(`Took READY Task ${task.id} "${task.name}" in the ${workspaceOf(task)}`);
    }
  }
}

async function stepOne(
  coworker: Coworker,
  hire: CoworkerTaskRow,
  ready: ReadonlyMap<string, TaskListItem>,
  pacing: Pacing,
  signal: AbortSignal,
): Promise<void> {
  const id = hire.sokosumiTaskId;
  try {
    const locked = await withTaskLock(coworker.db, id, () =>
      stepTask(coworker, hire, new Set(ready.keys()), signal),
    );
    if (!locked.acquired) {
      coworker.log(`Task ${id} is being worked by another Coworker process; skipping it`);
      pacing.pause(id, coworker.clock.now(), waitingIntervalMs);
      return;
    }
    if (locked.result === "WAITING") pacing.pause(id, coworker.clock.now(), waitingIntervalMs);
    else pacing.clear(id);
  } catch (error) {
    signal.throwIfAborted();
    const failure = classifyFailure(error, (ready.get(id)?.organizationId ?? null) !== null);
    if (failure.kind === "NEEDS_HUMAN") {
      coworker.log(`Task ${id} is waiting for a person: ${failure.action}`);
      pacing.pause(id, coworker.clock.now(), humanIntervalMs);
      return;
    }
    if (failure.kind === "STOP") {
      await moveStage(coworker.db, id, { stage: "STOPPED", stopReason: failure.reason });
      coworker.log(`Task ${id} STOPPED and needs an operator: ${failure.reason}`);
      return;
    }
    coworker.log(`Task ${id} will be retried: ${failure.reason}`);
    pacing.pause(id, coworker.clock.now(), retryIntervalMs);
  }
}

export async function runPass(
  coworker: Coworker,
  pacing: Pacing,
  signal: AbortSignal,
): Promise<void> {
  const listed = await coworker.core.listTasks(["READY"]);
  const ready = listed.filter((task) => task.assigneeId === coworker.coworkerId);
  await takeNewTasks(coworker, ready, pacing);
  const readyById = new Map(ready.map((task) => [task.id, task]));
  for (const hire of await workingTasks(coworker.db)) {
    signal.throwIfAborted();
    if (!pacing.due(hire.sokosumiTaskId, coworker.clock.now())) continue;
    await stepOne(coworker, hire, readyById, pacing, signal);
  }
}
