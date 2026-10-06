import type { CostRates } from "@datum/core";
import type { ApiDeps } from "../deps";
import { unavailable } from "../http/errors";

export const requireRates = (deps: ApiDeps): CostRates => {
  if (deps.rates.configured) return deps.rates.rates;
  throw unavailable(
    "COST_RATES_MISSING",
    `Datum cannot price physical work until ${deps.rates.missing.join(" and ")} ${deps.rates.missing.length > 1 ? "are" : "is"} set`,
  );
};
