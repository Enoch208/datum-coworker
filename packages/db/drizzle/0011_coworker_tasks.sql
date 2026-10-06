CREATE TABLE "coworker_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"sokosumi_task_id" text NOT NULL,
	"purpose" text NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"task_status" text,
	"body" text NOT NULL,
	"event_id" text,
	"posted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coworker_comments_once" UNIQUE("sokosumi_task_id","purpose","round"),
	CONSTRAINT "coworker_comments_purpose_known" CHECK ("coworker_comments"."purpose" in ('PROPOSAL', 'INPUT_REQUEST', 'ENDED')),
	CONSTRAINT "coworker_comments_status_known" CHECK ("coworker_comments"."task_status" is null or "coworker_comments"."task_status" in ('INPUT_REQUIRED', 'FAILED')),
	CONSTRAINT "coworker_comments_round_positive" CHECK ("coworker_comments"."round" >= 1),
	CONSTRAINT "coworker_comments_body_present" CHECK (length(trim("coworker_comments"."body")) > 0),
	CONSTRAINT "coworker_comments_posted_has_event" CHECK (("coworker_comments"."event_id" is null) = ("coworker_comments"."posted_at" is null))
);
--> statement-breakpoint
CREATE TABLE "coworker_tasks" (
	"sokosumi_task_id" text PRIMARY KEY NOT NULL,
	"stage" text DEFAULT 'INTAKE' NOT NULL,
	"input_requests" integer DEFAULT 0 NOT NULL,
	"plan_attempts" integer DEFAULT 0 NOT NULL,
	"escrow_tx_hash" text,
	"funds_locked_at" timestamp with time zone,
	"stop_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coworker_tasks_stage_known" CHECK ("coworker_tasks"."stage" in ('INTAKE', 'NEEDS_INPUT', 'CAMPAIGN', 'PAID', 'ENDED', 'STOPPED')),
	CONSTRAINT "coworker_tasks_counts_not_negative" CHECK ("coworker_tasks"."input_requests" >= 0 and "coworker_tasks"."plan_attempts" >= 0),
	CONSTRAINT "coworker_tasks_funds_locked_has_tx" CHECK (("coworker_tasks"."funds_locked_at" is null) = ("coworker_tasks"."escrow_tx_hash" is null)),
	CONSTRAINT "coworker_tasks_escrow_tx_is_hex" CHECK ("coworker_tasks"."escrow_tx_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coworker_tasks_stop_has_reason" CHECK (("coworker_tasks"."stage" in ('ENDED', 'STOPPED')) = ("coworker_tasks"."stop_reason" is not null))
);
--> statement-breakpoint
ALTER TABLE "coworker_comments" ADD CONSTRAINT "coworker_comments_sokosumi_task_id_coworker_tasks_sokosumi_task_id_fk" FOREIGN KEY ("sokosumi_task_id") REFERENCES "public"."coworker_tasks"("sokosumi_task_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coworker_tasks_stage_idx" ON "coworker_tasks" USING btree ("stage");