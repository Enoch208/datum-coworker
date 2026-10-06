import { localEnrolledRunner, runLoopPass, type PassReport } from "@datum/api/goal-loop";
import { createDb } from "@datum/db";
import { loadWorkerEnv } from "./env";
import { runUntilAborted } from "./loop";

const env = loadWorkerEnv(process.env);
const db = createDb(env.databaseUrl);
const deps = {
  db,
  appBaseUrl: env.appBaseUrl,
  rates: env.rates,
  executor: localEnrolledRunner({ db, appBaseUrl: env.appBaseUrl, rates: env.rates }),
  now: () => new Date(),
};

const report = ({ failed }: PassReport): void => {
  for (const { campaignId, error } of failed) {
    process.stderr.write(`Campaign ${campaignId} tick failed: ${error.stack ?? error.message}\n`);
  }
};

const controller = new AbortController();
const stop = (signalName: string) => () => {
  process.stdout.write(`Datum worker received ${signalName}; finishing the current step\n`);
  controller.abort();
};
process.once("SIGTERM", stop("SIGTERM"));
process.once("SIGINT", stop("SIGINT"));

process.stdout.write("Datum worker started\n");
await runUntilAborted(async (signal) => {
  report(await runLoopPass(deps, signal));
}, controller.signal);
await db.$client.end();
process.stdout.write("Datum worker stopped\n");
