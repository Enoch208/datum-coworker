import type { CostRates, PhysicalExecutor } from "@datum/core";
import type { Db } from "@datum/db";

export interface LoopDeps {
  readonly db: Db;
  readonly appBaseUrl: string;
  readonly rates: CostRates;
  readonly executor: PhysicalExecutor;
  readonly now: () => Date;
}
