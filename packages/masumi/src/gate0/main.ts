import { parseArgs } from "node:util";
import { createDb } from "@datum/db";
import { createBlockfrostReader } from "../chain/blockfrost";
import { blockfrostPreprodApiUrl, gate0AmountAtomic, tusdmUnit } from "../constants";
import { loadEnv } from "../env";
import { createDbEvidenceStore } from "../evidence-store";
import { systemClock } from "../lifecycle/deps";
import { createFileJournal } from "../lifecycle/journal";
import { runLifecycle } from "../lifecycle/machine";
import { createMpsClient } from "../mps/client";
import { createCoreClient } from "../sokosumi/client";
import { gate0EnvSchema } from "./env";
import { preflight } from "./preflight";
import { gate0Result } from "./result";
import { verifiedSummary } from "./summary";

const log = (line: string) => {
  process.stdout.write(`[gate0 ${new Date().toISOString()}] ${line}\n`);
};

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((arg) => arg !== "--"),
    options: { task: { type: "string" } },
    strict: true,
  });
  const env = loadEnv(gate0EnvSchema, process.env);
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
  const coworkerId = await preflight(core, mps, env.MASUMI_SELLING_WALLET_ID, log);
  if (values.task === undefined) {
    const ready = (await core.readyTasks()).filter((task) => task.assigneeId === coworkerId);
    log(`${String(ready.length)} READY Task(s) assigned to this Coworker:`);
    ready.forEach((task) => {
      log(`  ${task.id}  ${task.name}`);
    });
    log("Run again with --task <TASK_ID> to take one through the paid lifecycle");
    process.exitCode = 2;
    return;
  }
  const db = createDb(env.DATABASE_URL);
  const journal = createFileJournal(env.MASUMI_JOURNAL_DIR);
  const release = await journal.lock(values.task);
  try {
    const verified = await runLifecycle(
      values.task,
      {
        core,
        mps,
        chain: createBlockfrostReader({
          baseUrl: blockfrostPreprodApiUrl,
          projectId: env.BLOCKFROST_API_KEY_PREPROD,
          fetch,
        }),
        journal,
        evidence: createDbEvidenceStore(db),
        clock: systemClock,
        config: {
          agentIdentifier: env.MASUMI_AGENT_IDENTIFIER,
          supportedPaymentSourceIndex: env.MASUMI_SUPPORTED_PAYMENT_SOURCE_INDEX,
          sellerAddress: env.MASUMI_SELLER_ADDRESS,
          amountAtomic: gate0AmountAtomic,
          unit: tusdmUnit,
        },
        produceResult: gate0Result,
        log,
      },
      { pollMs: 10_000, maxConsecutiveFailures: 30 },
    );
    verifiedSummary(verified, tusdmUnit).forEach(log);
  } finally {
    await release();
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `[gate0] stopped: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
