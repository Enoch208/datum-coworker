import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  unique,
} from "drizzle-orm/pg-core";
import { brandPlaybooks, brands } from "./brands";
import { createdAt, instant, minorUnits, primaryId } from "./columns";
import { campaignStatus, currency, spotOutcome } from "./enums";

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
    inducedMiss: boolean("induced_miss").notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [unique("spots_campaign_code_unique").on(table.campaignId, table.code)],
);
