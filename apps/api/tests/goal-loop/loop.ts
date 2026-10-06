import type { PhysicalExecutor } from "@datum/core";
import { createDb, type Db } from "@datum/db";
import { localEnrolledRunner } from "../../src/executor/local-runner";
import type { LoopDeps } from "../../src/goal-loop/deps";
import { runLoopPass } from "../../src/goal-loop/pass";
import { appBaseUrl, db, testCostRates } from "../support";

export function loopDeps(overrides: Partial<LoopDeps> = {}): LoopDeps {
  const target = overrides.db ?? db;
  return {
    db: target,
    appBaseUrl,
    rates: testCostRates,
    executor: localEnrolledRunner({ db: target, appBaseUrl, rates: testCostRates }),
    planner: null,
    now: () => new Date(),
    ...overrides,
  };
}

export const runPass = (deps: LoopDeps = loopDeps()) =>
  runLoopPass(deps, new AbortController().signal);

export function secondWorkerDb(): Db {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is not set");
  return createDb(databaseUrl);
}

export function abortingAfter(
  creations: number,
  controller: AbortController,
  deps: LoopDeps = loopDeps(),
): PhysicalExecutor {
  const real = deps.executor;
  let created = 0;
  return {
    adapter: real.adapter,
    estimate: (draft) => real.estimate(draft),
    getTask: (ref) => real.getTask(ref),
    getEvidence: (ref) => real.getEvidence(ref),
    cancelTask: (ref) => real.cancelTask(ref),
    createTask: async (draft) => {
      const ref = await real.createTask(draft);
      created += 1;
      if (created === creations) controller.abort();
      return ref;
    },
  };
}

export async function passStoppedMidway(creations: number): Promise<unknown> {
  const controller = new AbortController();
  const deps = loopDeps();
  const stopping = { ...deps, executor: abortingAfter(creations, controller, deps) };
  return runLoopPass(stopping, controller.signal).then(
    () => new Error("the pass finished instead of stopping"),
    (thrown: unknown) => thrown,
  );
}

export function abortingBeforeCreate(
  controller: AbortController,
  deps: LoopDeps = loopDeps(),
): PhysicalExecutor {
  const real = deps.executor;
  return {
    ...abortingAfter(Number.POSITIVE_INFINITY, controller, deps),
    createTask: (draft) => {
      controller.abort();
      controller.signal.throwIfAborted();
      return real.createTask(draft);
    },
  };
}

export async function passStoppedBeforeCreating(): Promise<unknown> {
  const controller = new AbortController();
  const deps = loopDeps();
  const stopping = { ...deps, executor: abortingBeforeCreate(controller, deps) };
  return runLoopPass(stopping, controller.signal).then(
    () => new Error("the pass finished instead of stopping"),
    (thrown: unknown) => thrown,
  );
}
