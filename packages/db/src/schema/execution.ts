import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { campaignAssets } from "./assets";
import { campaigns, spots } from "./campaigns";
import { createdAt, instant, minorUnits, primaryId } from "./columns";
import { currency, executorAdapter, physicalTaskStatus, physicalTaskType } from "./enums";
import { runners } from "./runners";

export const physicalTasks = pgTable(
  "physical_tasks",
  {
    id: primaryId("tsk"),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    spotId: text("spot_id").references(() => spots.id),
    type: physicalTaskType("type").notNull(),
    adapter: executorAdapter("adapter").notNull(),
    attempt: integer("attempt").notNull(),
    idempotencyKey: text("idempotency_key")
      .notNull()
      .unique("physical_tasks_idempotency_key_unique"),
    externalTaskRef: text("external_task_ref"),
    status: physicalTaskStatus("status").notNull().default("CREATED"),
    assetVersion: integer("asset_version").notNull(),
    copies: integer("copies"),
    instructions: text("instructions").notNull(),
    assetUrls: text("asset_urls").array().notNull(),
    estimatedCostMinor: minorUnits("estimated_cost_minor").notNull(),
    committedCostMinor: minorUnits("committed_cost_minor").notNull().default(0),
    currency: currency("currency").notNull(),
    dueBy: instant("due_by").notNull(),
    runnerId: text("runner_id").references(() => runners.id),
    createdAt: createdAt(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    dispatchedAt: instant("dispatched_at"),
    acceptedAt: instant("accepted_at"),
    completedAt: instant("completed_at"),
  },
  (table) => [
    foreignKey({
      name: "physical_tasks_campaign_asset_fk",
      columns: [table.campaignId, table.assetVersion],
      foreignColumns: [campaignAssets.campaignId, campaignAssets.version],
    }),
    check("physical_tasks_attempt_positive", sql`${table.attempt} >= 1`),
    check(
      "physical_tasks_costs_non_negative",
      sql`${table.estimatedCostMinor} >= 0 and ${table.committedCostMinor} >= 0`,
    ),
    check(
      "physical_tasks_spot_matches_type",
      sql`(${table.type} = 'PLACE_SPOT') = (${table.spotId} is not null)`,
    ),
    check(
      "physical_tasks_copies_match_type",
      sql`(${table.type} = 'PRINT_AND_COLLECT') = (${table.copies} is not null and ${table.copies} >= 1)`,
    ),
    check(
      "physical_tasks_local_dispatch_has_runner",
      sql`${table.adapter} <> 'LOCAL_ENROLLED_RUNNER' or ${table.status} = 'CREATED' or ${table.runnerId} is not null`,
    ),
    index("physical_tasks_campaign_idx").on(table.campaignId),
    index("physical_tasks_runner_idx").on(table.runnerId),
  ],
);
