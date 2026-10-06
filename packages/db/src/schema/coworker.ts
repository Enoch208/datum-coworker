import { sql, type SQL } from "drizzle-orm";
import { check, index, integer, pgTable, text, unique } from "drizzle-orm/pg-core";
import { createdAt, instant, primaryId } from "./columns";

export const coworkerTaskStages = [
  "INTAKE",
  "NEEDS_INPUT",
  "CAMPAIGN",
  "PAID",
  "ENDED",
  "STOPPED",
] as const;
export type CoworkerTaskStage = (typeof coworkerTaskStages)[number];

export const coworkerCommentPurposes = ["PROPOSAL", "INPUT_REQUEST", "ENDED"] as const;
export type CoworkerCommentPurpose = (typeof coworkerCommentPurposes)[number];

export const coworkerCommentStatuses = ["INPUT_REQUIRED", "FAILED"] as const;
export type CoworkerCommentStatus = (typeof coworkerCommentStatuses)[number];

const oneOf = (values: readonly string[]): SQL =>
  sql.raw(`(${values.map((value) => `'${value}'`).join(", ")})`);

export const coworkerTasks = pgTable(
  "coworker_tasks",
  {
    sokosumiTaskId: text("sokosumi_task_id").primaryKey(),
    stage: text("stage", { enum: coworkerTaskStages }).notNull().default("INTAKE"),
    inputRequests: integer("input_requests").notNull().default(0),
    planAttempts: integer("plan_attempts").notNull().default(0),
    escrowTxHash: text("escrow_tx_hash"),
    fundsLockedAt: instant("funds_locked_at"),
    stopReason: text("stop_reason"),
    createdAt: createdAt(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check("coworker_tasks_stage_known", sql`${table.stage} in ${oneOf(coworkerTaskStages)}`),
    check(
      "coworker_tasks_counts_not_negative",
      sql`${table.inputRequests} >= 0 and ${table.planAttempts} >= 0`,
    ),
    check(
      "coworker_tasks_funds_locked_has_tx",
      sql`(${table.fundsLockedAt} is null) = (${table.escrowTxHash} is null)`,
    ),
    check("coworker_tasks_escrow_tx_is_hex", sql`${table.escrowTxHash} ~ '^[0-9a-f]{64}$'`),
    check(
      "coworker_tasks_stop_has_reason",
      sql`(${table.stage} in ('ENDED', 'STOPPED')) = (${table.stopReason} is not null)`,
    ),
    index("coworker_tasks_stage_idx").on(table.stage),
  ],
);

export const coworkerComments = pgTable(
  "coworker_comments",
  {
    id: primaryId("cmt"),
    sokosumiTaskId: text("sokosumi_task_id")
      .notNull()
      .references(() => coworkerTasks.sokosumiTaskId),
    purpose: text("purpose", { enum: coworkerCommentPurposes }).notNull(),
    round: integer("round").notNull().default(1),
    taskStatus: text("task_status", { enum: coworkerCommentStatuses }),
    body: text("body").notNull(),
    eventId: text("event_id"),
    postedAt: instant("posted_at"),
    createdAt: createdAt(),
  },
  (table) => [
    unique("coworker_comments_once").on(table.sokosumiTaskId, table.purpose, table.round),
    check(
      "coworker_comments_purpose_known",
      sql`${table.purpose} in ${oneOf(coworkerCommentPurposes)}`,
    ),
    check(
      "coworker_comments_status_known",
      sql`${table.taskStatus} is null or ${table.taskStatus} in ${oneOf(coworkerCommentStatuses)}`,
    ),
    check("coworker_comments_round_positive", sql`${table.round} >= 1`),
    check("coworker_comments_body_present", sql`length(trim(${table.body})) > 0`),
    check(
      "coworker_comments_posted_has_event",
      sql`(${table.eventId} is null) = (${table.postedAt} is null)`,
    ),
  ],
);
