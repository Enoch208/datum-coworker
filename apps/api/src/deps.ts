import type { Db } from "@datum/db";
import type { BrandPageReader } from "./brand-page/reader";
import type { RateSettings } from "./env";
import type { PlannerModel } from "./planner/model";
import type { ReceiptReader } from "./receipts/reader";

export interface ApiDeps {
  readonly db: Db;
  readonly appBaseUrl: string;
  readonly operatorKey: string | null;
  readonly assetDir: string;
  readonly evidenceDir: string;
  readonly planner: PlannerModel | null;
  readonly receiptReader: ReceiptReader | null;
  readonly rates: RateSettings;
  readonly readBrandPage: BrandPageReader;
}
