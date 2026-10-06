ALTER TYPE "public"."audit_event_type" ADD VALUE 'EXPENSE_DISPUTED' BEFORE 'GOAL_EVALUATED';--> statement-breakpoint
CREATE TABLE "runners" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"inbox_token_hash" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runners_inbox_token_hash_unique" UNIQUE("inbox_token_hash"),
	CONSTRAINT "runners_inbox_token_is_hash" CHECK ("runners"."inbox_token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "runners_name_present" CHECK (length(trim("runners"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "evidence" ALTER COLUMN "photo_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "receipt_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN "photo_file" text NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN "explanation" text NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "receipt_file" text NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "content_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "explanation" text NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "physical_tasks" ADD COLUMN "asset_version" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "physical_tasks" ADD COLUMN "copies" integer;--> statement-breakpoint
ALTER TABLE "physical_tasks" ADD COLUMN "runner_id" text;--> statement-breakpoint
ALTER TABLE "physical_tasks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "physical_tasks" ADD COLUMN "dispatched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "physical_tasks" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "physical_tasks" ADD CONSTRAINT "physical_tasks_runner_id_runners_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."runners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physical_tasks" ADD CONSTRAINT "physical_tasks_campaign_asset_fk" FOREIGN KEY ("campaign_id","asset_version") REFERENCES "public"."campaign_assets"("campaign_id","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_one_live_per_task" ON "expenses" USING btree ("physical_task_id") WHERE status <> 'DISPUTED';--> statement-breakpoint
CREATE INDEX "physical_tasks_runner_idx" ON "physical_tasks" USING btree ("runner_id");--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_photo_file_is_stored_image" CHECK ("evidence"."photo_file" ~ '^[0-9a-f]{32}[.]jpg$');--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_content_hash_is_sha256" CHECK ("expenses"."content_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_receipt_file_is_stored_image" CHECK ("expenses"."receipt_file" ~ '^[0-9a-f]{32}[.]jpg$');--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_decided_has_time" CHECK (("expenses"."status" = 'SUBMITTED') = ("expenses"."decided_at" is null));--> statement-breakpoint
ALTER TABLE "physical_tasks" ADD CONSTRAINT "physical_tasks_spot_matches_type" CHECK (("physical_tasks"."type" = 'PLACE_SPOT') = ("physical_tasks"."spot_id" is not null));--> statement-breakpoint
ALTER TABLE "physical_tasks" ADD CONSTRAINT "physical_tasks_copies_match_type" CHECK (("physical_tasks"."type" = 'PRINT_AND_COLLECT') = ("physical_tasks"."copies" is not null and "physical_tasks"."copies" >= 1));--> statement-breakpoint
ALTER TABLE "physical_tasks" ADD CONSTRAINT "physical_tasks_local_dispatch_has_runner" CHECK ("physical_tasks"."adapter" <> 'LOCAL_ENROLLED_RUNNER' or "physical_tasks"."status" = 'CREATED' or "physical_tasks"."runner_id" is not null);