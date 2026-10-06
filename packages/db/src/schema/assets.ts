import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, text, unique } from "drizzle-orm/pg-core";
import type { EstimatedPlanStep } from "@datum/core";
import { campaigns } from "./campaigns";
import { createdAt, minorUnits, primaryId } from "./columns";
import { currency, printFormat } from "./enums";

export const campaignAssets = pgTable(
  "campaign_assets",
  {
    id: primaryId("ast"),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    version: integer("version").notNull(),
    templateVersion: integer("template_version").notNull(),
    headline: text("headline").notNull(),
    subcopy: text("subcopy").notNull(),
    printFormat: printFormat("print_format").notNull(),
    steps: jsonb("steps").$type<EstimatedPlanStep[]>().notNull(),
    estimatedSpendMinor: minorUnits("estimated_spend_minor").notNull(),
    currency: currency("currency").notNull(),
    assumptions: text("assumptions").array().notNull(),
    customerWarnings: text("customer_warnings").array().notNull(),
    plannedByModel: text("planned_by_model").notNull(),
    assetHash: text("asset_hash").notNull(),
    spotsHash: text("spots_hash").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique("campaign_assets_campaign_version_unique").on(table.campaignId, table.version),
    check("campaign_assets_version_positive", sql`${table.version} >= 1`),
    check("campaign_assets_spend_non_negative", sql`${table.estimatedSpendMinor} >= 0`),
    check("campaign_assets_asset_hash_is_sha256", sql`${table.assetHash} ~ '^[0-9a-f]{64}$'`),
    check("campaign_assets_spots_hash_is_sha256", sql`${table.spotsHash} ~ '^[0-9a-f]{64}$'`),
  ],
);
