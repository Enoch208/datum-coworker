import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localEnrolledRunner, runLoopPass } from "@datum/api/goal-loop";
import type { CostRates } from "@datum/core";
import { createDb } from "@datum/db";
import { createFileJournal, gate0AmountAtomic, tusdmUnit, type TaskListItem } from "@datum/masumi";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import { createApp } from "../../../api/src/app";
import { fixturePlanner, plannerFixture } from "../../../api/tests/planner/fixture-model";
import { FakeClock } from "../../../../packages/masumi/tests/support/clock";
import { fakeCore, fakeMps, worldChain } from "../../../../packages/masumi/tests/support/fakes";
import { World } from "../../../../packages/masumi/tests/support/world";
import { recordedSeller } from "../../../../packages/masumi/tests/fixtures/mps-payment";
import type { Coworker, CoworkerCore } from "../../src/context";
import { Pacing } from "../../src/pacing";
import { runPass } from "../../src/pass";
import { completeBrief, scriptedBriefModel } from "./briefs";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || !databaseUrl.endsWith("/datum_test")) {
  throw new Error("Coworker tests must run against the datum_test database");
}

export const db = createDb(databaseUrl);
export const appBaseUrl = "https://datum.test";
export const operatorKey = "operator-key-for-coworker-tests-0123456789";

const rates: CostRates = {
  printCostPerCopy: { amountMinor: 100, currency: "SGD" },
  placementCostPerSpot: { amountMinor: 500, currency: "SGD" },
};

const everyTable = sql.raw(
  [
    "coworker_comments",
    "coworker_tasks",
    "campaign_receipts",
    "interventions",
    "remediation_decisions",
    "masumi_payment_evidence",
    "scan_events",
    "audit_events",
    "evidence",
    "expenses",
    "physical_tasks",
    "runners",
    "approvals",
    "campaign_assets",
    "spots",
    "campaigns",
    "brand_playbooks",
    "brands",
  ].join(", "),
);

export function resetDatabaseBetweenTests(): void {
  beforeEach(async () => {
    await db.execute(sql`truncate ${everyTable} cascade`);
  });
  afterAll(async () => {
    await db.$client.end();
  });
}

const listItem = (world: World): TaskListItem => {
  const task = world.task();
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    status: task.status,
    assigneeId: task.assigneeId,
    ownerId: task.ownerId,
    organizationId: task.organizationId,
    workspace: task.workspace,
  };
};

export interface Harness {
  readonly clock: FakeClock;
  readonly world: World;
  readonly coworker: Coworker;
  readonly lines: string[];
  readonly briefModel: ReturnType<typeof scriptedBriefModel>;
  readonly journalDir: string;
  readonly api: ReturnType<typeof createApp>;
  pass(coworker?: Coworker): Promise<void>;
  passesUntil(
    done: () => Promise<boolean>,
    stepMs: number,
    options?: { readonly coworker?: Coworker; readonly limit?: number },
  ): Promise<number>;
  loopAt(now: Date): Promise<void>;
}

export function harness(): Harness {
  const clock = new FakeClock(Date.now());
  const world = new World(clock);
  const journalDir = mkdtempSync(join(tmpdir(), "datum-coworker-journal-"));
  const assetDir = mkdtempSync(join(tmpdir(), "datum-coworker-assets-"));
  const lines: string[] = [];
  const briefModel = scriptedBriefModel(completeBrief());
  const planner = fixturePlanner(plannerFixture("plan-accepted"));
  const core: CoworkerCore = {
    ...fakeCore(world),
    listTasks: (statuses) =>
      Promise.resolve(statuses.includes(world.taskStatus) ? [listItem(world)] : []),
  };
  const loopDeps = (now: () => Date) => ({
    db,
    appBaseUrl,
    rates,
    executor: localEnrolledRunner({ db, appBaseUrl, rates }),
    planner: null,
    now,
  });
  const coworker: Coworker = {
    coworkerId: world.coworkerId,
    db,
    core,
    mps: fakeMps(world),
    chain: worldChain(world),
    journal: createFileJournal(journalDir),
    clock,
    config: {
      agentIdentifier: recordedSeller.agentIdentifier,
      supportedPaymentSourceIndex: 0,
      sellerAddress: recordedSeller.sellerAddress,
      amountAtomic: gate0AmountAtomic,
      unit: tusdmUnit,
    },
    campaigns: {
      db,
      appBaseUrl,
      assetDir,
      planner,
      rates: { configured: true, rates },
      readBrandPage: () => Promise.resolve({ outcome: "NOT_GIVEN" }),
    },
    loop: loopDeps(() => new Date(clock.now())),
    briefModel,
    log: (line) => lines.push(line),
  };
  const api = createApp({
    db,
    appBaseUrl,
    operatorKey,
    assetDir,
    evidenceDir: mkdtempSync(join(tmpdir(), "datum-coworker-evidence-")),
    planner,
    receiptReader: null,
    rates: { configured: true, rates },
    readBrandPage: () => Promise.resolve({ outcome: "NOT_GIVEN" }),
  });
  const pass = (target: Coworker = coworker) =>
    runPass(target, new Pacing(), new AbortController().signal);
  return {
    clock,
    world,
    coworker,
    lines,
    briefModel,
    journalDir,
    api,
    pass,
    async passesUntil(done, stepMs, options = {}) {
      const limit = options.limit ?? 60;
      for (let passes = 1; passes <= limit; passes += 1) {
        await pass(options.coworker);
        if (await done()) return passes;
        clock.advance(stepMs);
      }
      throw new Error(`Not done after ${String(limit)} passes:\n${lines.slice(-8).join("\n")}`);
    },
    async loopAt(now) {
      await runLoopPass(
        loopDeps(() => now),
        new AbortController().signal,
      );
    },
  };
}
