import type { Db } from "@datum/db";
import type { BrandPageReader } from "./brand-page/reader";
import type { RateSettings } from "./env";
import type { PlannerModel } from "./planner/model";

export interface ApiDeps {
  readonly db: Db;
  readonly appBaseUrl: string;
  readonly assetDir: string;
  readonly planner: PlannerModel | null;
  readonly rates: RateSettings;
  readonly readBrandPage: BrandPageReader;
}
