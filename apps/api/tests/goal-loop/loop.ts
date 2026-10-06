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
