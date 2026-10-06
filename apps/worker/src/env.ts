import { currencies, isMoneyText, parseMoney, type CostRates } from "@datum/core";
import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

const moneyText = z.string().trim().refine(isMoneyText, "must be a decimal amount such as 0.80");

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  APP_BASE_URL: z.url({ protocol: /^https?$/ }).transform((url) => url.replace(/\/+$/, "")),
  ANTHROPIC_API_KEY: optionalText,
  DATUM_PRINT_COST_PER_COPY: moneyText,
  DATUM_PLACEMENT_COST_PER_SPOT: moneyText,
});

export interface WorkerEnv {
  readonly databaseUrl: string;
  readonly appBaseUrl: string;
  readonly anthropicApiKey: string | null;
  readonly rates: CostRates;
}

const [rateCurrency] = currencies;

export function loadWorkerEnv(source: NodeJS.ProcessEnv): WorkerEnv {
  const env = envSchema.parse(source);
  return {
    databaseUrl: env.DATABASE_URL,
    appBaseUrl: env.APP_BASE_URL,
    anthropicApiKey: env.ANTHROPIC_API_KEY ?? null,
    rates: {
      printCostPerCopy: parseMoney(env.DATUM_PRINT_COST_PER_COPY, rateCurrency),
      placementCostPerSpot: parseMoney(env.DATUM_PLACEMENT_COST_PER_SPOT, rateCurrency),
    },
  };
}
