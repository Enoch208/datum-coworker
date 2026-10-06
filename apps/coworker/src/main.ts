import { setTimeout as sleep } from "node:timers/promises";
import {
  brandPageLimits,
  createAnthropicPlannerModel,
  createBrandPageReader,
  createHtmlFetcher,
} from "@datum/api/campaign-service";
import { localEnrolledRunner } from "@datum/api/goal-loop";
import { createDb } from "@datum/db";
import {
  blockfrostPreprodApiUrl,
  createBlockfrostReader,
  createCoreClient,
  createFileJournal,
  createMpsClient,
  gate0AmountAtomic,
  preflight,
  systemClock,
  tusdmUnit,
} from "@datum/masumi";
import { createAnthropicBriefReader } from "./brief/read";
import type { Coworker } from "./context";
import { costRates, loadCoworkerEnv } from "./env";
import { Pacing, passIntervalMs } from "./pacing";
import { runPass } from "./pass";

const log = (line: string): void => {
  process.stdout.write(`[coworker ${new Date().toISOString()}] ${line}\n`);
};

const env = loadCoworkerEnv(process.env);
const db = createDb(env.DATABASE_URL);
const core = createCoreClient({
  baseUrl: env.SOKOSUMI_API_URL,
  apiKey: env.SOKOSUMI_COWORKER_API_KEY,
  fetch,
});
const mps = createMpsClient({
  baseUrl: env.MASUMI_PAYMENT_API_URL,
  token: env.MASUMI_PAYMENT_API_KEY,
  fetch,
});
const rates = costRates(env);
const appBaseUrl = env.APP_BASE_URL;
const apiKey = env.ANTHROPIC_API_KEY;

const coworker: Coworker = {
  coworkerId: await preflight(core, mps, env.MASUMI_SELLING_WALLET_ID, log),
  db,
  core,
  mps,
  chain: createBlockfrostReader({
    baseUrl: blockfrostPreprodApiUrl,
    projectId: env.BLOCKFROST_API_KEY_PREPROD,
    fetch,
  }),
  journal: createFileJournal(env.COWORKER_JOURNAL_DIR),
  clock: systemClock,
  config: {
    agentIdentifier: env.MASUMI_AGENT_IDENTIFIER,
    supportedPaymentSourceIndex: env.MASUMI_SUPPORTED_PAYMENT_SOURCE_INDEX,
    sellerAddress: env.MASUMI_SELLER_ADDRESS,
    amountAtomic: gate0AmountAtomic,
    unit: tusdmUnit,
  },
  campaigns: {
    db,
    appBaseUrl,
    assetDir: env.ASSET_DIR,
    planner: apiKey === undefined ? null : createAnthropicPlannerModel({ apiKey }),
    rates: { configured: true, rates },
    readBrandPage: createBrandPageReader(createHtmlFetcher(brandPageLimits)),
  },
  loop: {
    db,
    appBaseUrl,
    rates,
    executor: localEnrolledRunner({ db, appBaseUrl, rates }),
    planner: null,
    now: () => new Date(),
  },
  briefModel: apiKey === undefined ? null : createAnthropicBriefReader({ apiKey }),
  log,
};

const controller = new AbortController();
const stop = (signalName: string) => () => {
  log(`received ${signalName}; finishing the current step`);
  controller.abort();
};
process.once("SIGTERM", stop("SIGTERM"));
process.once("SIGINT", stop("SIGINT"));

const pacing = new Pacing();
const isShutdown = (error: unknown): boolean =>
  controller.signal.aborted && error instanceof Error && error.name === "AbortError";
const pause = () =>
  sleep(passIntervalMs, undefined, { signal: controller.signal }).catch((error: unknown) => {
    if (!isShutdown(error)) throw error;
  });

log(
  `Datum Coworker ${coworker.coworkerId} polling READY Tasks every ${String(passIntervalMs / 1000)} s${coworker.briefModel === null ? " (AI planner not configured: no new Tasks are taken)" : ""}`,
);
while (!controller.signal.aborted) {
  try {
    await runPass(coworker, pacing, controller.signal);
  } catch (error) {
    if (!isShutdown(error)) {
      log(
        `pass failed; the next pass retries: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  await pause();
}
await db.$client.end();
log("Datum Coworker stopped");
