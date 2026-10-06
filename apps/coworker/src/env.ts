import { isAbsolute } from "node:path";
import { currencies, isMoneyText, parseMoney, type CostRates } from "@datum/core";
import { defaultDatumDir, gate0EnvSchema, httpUrl, loadEnv } from "@datum/masumi";
import { z } from "zod";

const moneyText = z.string().trim().refine(isMoneyText, "must be a decimal amount such as 0.80");

const coworkerEnvSchema = gate0EnvSchema.omit({ MASUMI_JOURNAL_DIR: true }).extend({
  APP_BASE_URL: httpUrl,
  ASSET_DIR: z.string().refine(isAbsolute, "must be the API's absolute card directory"),
  ANTHROPIC_API_KEY: z.string().trim().min(1).optional(),
  DATUM_PRINT_COST_PER_COPY: moneyText,
  DATUM_PLACEMENT_COST_PER_SPOT: moneyText,
  COWORKER_JOURNAL_DIR: z.string().min(1).default(defaultDatumDir("coworker-journal")),
});

export type CoworkerEnv = z.output<typeof coworkerEnvSchema>;

const [rateCurrency] = currencies;

export const loadCoworkerEnv = (source: NodeJS.ProcessEnv): CoworkerEnv =>
  loadEnv(coworkerEnvSchema, source);

export const costRates = (env: CoworkerEnv): CostRates => ({
  printCostPerCopy: parseMoney(env.DATUM_PRINT_COST_PER_COPY, rateCurrency),
  placementCostPerSpot: parseMoney(env.DATUM_PLACEMENT_COST_PER_SPOT, rateCurrency),
});
