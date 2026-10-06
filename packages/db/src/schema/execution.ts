import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, unique } from "drizzle-orm/pg-core";
import type { EvidenceChecks, GeoPoint } from "@datum/core";
import { campaigns, spots } from "./campaigns";
import { createdAt, instant, minorUnits, primaryId } from "./columns";
import {
  currency,
  evidenceFailure,
  evidenceVerdict,
  executorAdapter,
  expenseStatus,
  physicalTaskStatus,
  physicalTaskType,
} from "./enums";

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
    instructions: text("instructions").notNull(),
    assetUrls: text("asset_urls").array().notNull(),
    estimatedCostMinor: minorUnits("estimated_cost_minor").notNull(),
    committedCostMinor: minorUnits("committed_cost_minor").notNull().default(0),
    currency: currency("currency").notNull(),
    dueBy: instant("due_by").notNull(),
    runnerTokenHash: text("runner_token_hash").unique("physical_tasks_runner_token_hash_unique"),
    runnerTokenExpiresAt: instant("runner_token_expires_at"),
    createdAt: createdAt(),
    completedAt: instant("completed_at"),
  },
  (table) => [
    check("physical_tasks_attempt_positive", sql`${table.attempt} >= 1`),
    check(
      "physical_tasks_costs_non_negative",
      sql`${table.estimatedCostMinor} >= 0 and ${table.committedCostMinor} >= 0`,
    ),
    check("physical_tasks_runner_token_is_hash", sql`${table.runnerTokenHash} ~ '^[0-9a-f]{64}$'`),
    check(
      "physical_tasks_runner_token_expires",
      sql`(${table.runnerTokenHash} is null) = (${table.runnerTokenExpiresAt} is null)`,
    ),
    index("physical_tasks_campaign_idx").on(table.campaignId),
  ],
);

export const evidence = pgTable(
  "evidence",
  {
    id: primaryId("evd"),
    physicalTaskId: text("physical_task_id")
      .notNull()
      .references(() => physicalTasks.id),
    spotId: text("spot_id").references(() => spots.id),
    contentHash: text("content_hash").notNull(),
    photoUrl: text("photo_url").notNull(),
    submittedAt: instant("submitted_at").notNull(),
    decodedCampaignId: text("decoded_campaign_id"),
    decodedSpotCode: text("decoded_spot_code"),
    optionalGeo: jsonb("optional_geo").$type<GeoPoint>(),
    checks: jsonb("checks").$type<EvidenceChecks>(),
    verdict: evidenceVerdict("verdict"),
    failure: evidenceFailure("failure"),
    createdAt: createdAt(),
  },
  (table) => [
    unique("evidence_task_content_unique").on(table.physicalTaskId, table.contentHash),
    check("evidence_content_hash_is_sha256", sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    check(
      "evidence_failure_only_on_fail",
      sql`coalesce(${table.verdict} = 'FAIL', false) = (${table.failure} is not null)`,
    ),
    check(
      "evidence_verdict_has_checks",
      sql`(${table.verdict} is null) = (${table.checks} is null)`,
    ),
    index("evidence_spot_idx").on(table.spotId),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: primaryId("exp"),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    physicalTaskId: text("physical_task_id")
      .notNull()
      .references(() => physicalTasks.id),
    receiptUrl: text("receipt_url").notNull(),
    merchant: text("merchant"),
    amountMinor: minorUnits("amount_minor").notNull(),
    currency: currency("currency").notNull(),
    status: expenseStatus("status").notNull().default("SUBMITTED"),
    ocr: jsonb("ocr"),
    createdAt: createdAt(),
  },
  (table) => [
    check("expenses_amount_positive", sql`${table.amountMinor} > 0`),
    index("expenses_campaign_idx").on(table.campaignId),
  ],
);
