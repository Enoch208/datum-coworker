import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, unique, uniqueIndex } from "drizzle-orm/pg-core";
import type { EvidenceChecks, GeoPoint } from "@datum/core";
import { campaigns, spots } from "./campaigns";
import { createdAt, instant, minorUnits, primaryId } from "./columns";
import { currency, evidenceFailure, evidenceVerdict, expenseKind, expenseStatus } from "./enums";
import { physicalTasks } from "./execution";

export const evidence = pgTable(
  "evidence",
  {
    id: primaryId("evd"),
    physicalTaskId: text("physical_task_id")
      .notNull()
      .references(() => physicalTasks.id),
    spotId: text("spot_id").references(() => spots.id),
    contentHash: text("content_hash").notNull(),
    photoFile: text("photo_file").notNull(),
    submittedAt: instant("submitted_at").notNull(),
    decodedCampaignId: text("decoded_campaign_id"),
    decodedSpotCode: text("decoded_spot_code"),
    optionalGeo: jsonb("optional_geo").$type<GeoPoint>(),
    checks: jsonb("checks").$type<EvidenceChecks>(),
    verdict: evidenceVerdict("verdict"),
    failure: evidenceFailure("failure"),
    explanation: text("explanation").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique("evidence_task_content_unique").on(table.physicalTaskId, table.contentHash),
    check("evidence_content_hash_is_sha256", sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    check("evidence_photo_file_is_stored_image", sql`${table.photoFile} ~ '^[0-9a-f]{32}[.]jpg$'`),
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
    kind: expenseKind("kind").notNull().default("RECEIPT"),
    receiptFile: text("receipt_file"),
    contentHash: text("content_hash"),
    merchant: text("merchant"),
    amountMinor: minorUnits("amount_minor").notNull(),
    currency: currency("currency").notNull(),
    status: expenseStatus("status").notNull().default("SUBMITTED"),
    ocr: jsonb("ocr"),
    explanation: text("explanation").notNull(),
    createdAt: createdAt(),
    decidedAt: instant("decided_at"),
  },
  (table) => [
    check("expenses_amount_positive", sql`${table.amountMinor} > 0`),
    check("expenses_content_hash_is_sha256", sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    check(
      "expenses_receipt_file_is_stored_image",
      sql`${table.receiptFile} ~ '^[0-9a-f]{32}[.]jpg$'`,
    ),
    check(
      "expenses_receipt_has_image",
      sql`(${table.kind} = 'RECEIPT') = (${table.receiptFile} is not null and ${table.contentHash} is not null)`,
    ),
    check(
      "expenses_decided_has_time",
      sql`(${table.status} = 'SUBMITTED') = (${table.decidedAt} is null)`,
    ),
    uniqueIndex("expenses_one_live_per_task")
      .on(table.physicalTaskId)
      .where(sql`status <> 'DISPUTED'`),
    index("expenses_campaign_idx").on(table.campaignId),
  ],
);
