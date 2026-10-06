import { currencies, isMoneyText, parseMoney, type CostRates } from "@datum/core";
import { z } from "zod";

const httpUrl = z.url({ protocol: /^https?$/ });
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();
const optionalMoneyText = optionalText.refine(
  (value) => value === undefined || isMoneyText(value),
  "must be a decimal amount such as 0.80",
);

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  APP_BASE_URL: httpUrl.transform((url) => url.replace(/\/+$/, "")),
  PORT: z.coerce.number().int().positive().default(8790),
  HOST: z.string().min(1).default("127.0.0.1"),
  ASSET_DIR: optionalText.transform((value) => value ?? "./.assets"),
  ANTHROPIC_API_KEY: optionalText,
  DATUM_PRINT_COST_PER_COPY: optionalMoneyText,
  DATUM_PLACEMENT_COST_PER_SPOT: optionalMoneyText,
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}

export type RateSettings =
  | { readonly configured: true; readonly rates: CostRates }
  | { readonly configured: false; readonly missing: readonly string[] };

const [rateCurrency] = currencies;

export function rateSettings(env: Env): RateSettings {
  const print = env.DATUM_PRINT_COST_PER_COPY;
  const placement = env.DATUM_PLACEMENT_COST_PER_SPOT;
  if (print === undefined || placement === undefined) {
    const missing = [
      ...(print === undefined ? ["DATUM_PRINT_COST_PER_COPY"] : []),
      ...(placement === undefined ? ["DATUM_PLACEMENT_COST_PER_SPOT"] : []),
    ];
    return { configured: false, missing };
  }
  return {
    configured: true,
    rates: {
      printCostPerCopy: parseMoney(print, rateCurrency),
      placementCostPerSpot: parseMoney(placement, rateCurrency),
    },
  };
}
