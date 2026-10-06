import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, text, unique } from "drizzle-orm/pg-core";
import { brandPlaybooks, brands } from "./brands";
import { createdAt, instant, minorUnits, primaryId } from "./columns";
import { campaignStatus, currency, evidencePolicy, spotOutcome } from "./enums";

export const campaigns = pgTable(
  "campaigns",
  {
    id: primaryId("cmp"),
    buyerRef: text("buyer_ref"),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id),
    brandPlaybookVersion: integer("brand_playbook_version"),
    message: text("message").notNull(),
    destinationUrl: text("destination_url").notNull(),
    status: campaignStatus("status").notNull().default("DRAFT"),
    deadline: instant("deadline").notNull(),
    budgetMinor: minorUnits("budget_minor").notNull(),
    currency: currency("currency").notNull(),
    approvedAt: instant("approved_at"),
    completedAt: instant("completed_at"),
    canonicalResultHash: text("canonical_result_hash"),
    sokosumiTaskId: text("sokosumi_task_id").unique("campaigns_sokosumi_task_unique"),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: "campaigns_brand_playbook_fk",
      columns: [table.brandId, table.brandPlaybookVersion],
      foreignColumns: [brandPlaybooks.brandId, brandPlaybooks.version],
    }),
    check("campaigns_budget_positive", sql`${table.budgetMinor} > 0`),
    check(
      "campaigns_completed_has_time",
      sql`${table.status} <> 'COMPLETED' or ${table.completedAt} is not null`,
    ),
    index("campaigns_status_idx").on(table.status),
  ],
);

export const spots = pgTable(
  "spots",
  {
    id: primaryId("spt"),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    instructions: text("instructions").notNull(),
    qrTargetUrl: text("qr_target_url").notNull(),
    assetUrl: text("asset_url"),
    status: spotOutcome("status").notNull().default("PENDING"),
    firstPassStatus: spotOutcome("first_pass_status").notNull().default("PENDING"),
    createdAt: createdAt(),
  },
  (table) => [unique("spots_campaign_code_unique").on(table.campaignId, table.code)],
);

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
    budgetMinor: minorUnits("budget_minor").notNull(),
    currency: currency("currency").notNull(),
    deadline: instant("deadline").notNull(),
    evidencePolicy: evidencePolicy("evidence_policy").notNull(),
    approvedBy: text("approved_by").notNull(),
    approvedAt: instant("approved_at").notNull(),
  },
  (table) => [
    unique("approvals_campaign_version_unique").on(table.campaignId, table.version),
    check("approvals_version_positive", sql`${table.version} >= 1`),
    check("approvals_asset_version_positive", sql`${table.assetVersion} >= 1`),
    check("approvals_budget_positive", sql`${table.budgetMinor} > 0`),
  ],
);
