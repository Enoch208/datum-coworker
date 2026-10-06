import { sql } from "drizzle-orm";
import { check, foreignKey, integer, pgTable, text, unique } from "drizzle-orm/pg-core";
import { campaignAssets } from "./assets";
import { campaigns } from "./campaigns";
import { instant, minorUnits, primaryId } from "./columns";
import { currency, evidencePolicy } from "./enums";

export const approvals = pgTable(
  "approvals",
  {
    id: primaryId("apr"),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    version: integer("version").notNull(),
    assetVersion: integer("asset_version").notNull(),
    assetHash: text("asset_hash").notNull(),
    spotsHash: text("spots_hash").notNull(),
    approvedHeadline: text("approved_headline").notNull(),
    approvedSubcopy: text("approved_subcopy").notNull(),
    budgetMinor: minorUnits("budget_minor").notNull(),
    currency: currency("currency").notNull(),
    deadline: instant("deadline").notNull(),
    evidencePolicy: evidencePolicy("evidence_policy").notNull(),
    approvedBy: text("approved_by").notNull(),
    approvedAt: instant("approved_at").notNull(),
  },
  (table) => [
    unique("approvals_campaign_version_unique").on(table.campaignId, table.version),
    foreignKey({
      name: "approvals_campaign_asset_fk",
      columns: [table.campaignId, table.assetVersion],
      foreignColumns: [campaignAssets.campaignId, campaignAssets.version],
    }),
    check("approvals_version_positive", sql`${table.version} >= 1`),
    check("approvals_asset_version_positive", sql`${table.assetVersion} >= 1`),
    check("approvals_budget_positive", sql`${table.budgetMinor} > 0`),
  ],
);
