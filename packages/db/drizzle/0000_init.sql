CREATE TYPE "public"."audit_event_type" AS ENUM('CAMPAIGN_CREATED', 'PLAN_GENERATED', 'CAMPAIGN_APPROVED', 'STATUS_CHANGED', 'TASK_CREATED', 'TASK_DISPATCHED', 'TASK_ACCEPTED', 'TASK_COMPLETED', 'TASK_CANCELLED', 'EVIDENCE_RECEIVED', 'EVIDENCE_EVALUATED', 'EXPENSE_SUBMITTED', 'EXPENSE_CONFIRMED', 'GOAL_EVALUATED', 'GAP_DETECTED', 'RECOVERY_CREATED', 'APPROVAL_REQUESTED', 'RECEIPT_PUBLISHED');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('DRAFT', 'PLANNING', 'AWAITING_APPROVAL', 'APPROVED', 'EXECUTING', 'VERIFYING', 'REMEDIATING', 'COMPLETED', 'EXPIRED_INCOMPLETE', 'FAILED', 'CANCELLED', 'NEEDS_APPROVAL');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('SGD');--> statement-breakpoint
CREATE TYPE "public"."evidence_failure" AS ENUM('NO_EVIDENCE', 'QR_NOT_FOUND', 'QR_WRONG_CAMPAIGN', 'QR_WRONG_SPOT', 'LATE_EVIDENCE', 'EXECUTOR_CANCELLED', 'TASK_EXPIRED', 'ADVISORY_REVIEW_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."evidence_policy" AS ENUM('photo_with_decodable_spot_qr');--> statement-breakpoint
CREATE TYPE "public"."evidence_verdict" AS ENUM('PASS', 'FAIL');--> statement-breakpoint
CREATE TYPE "public"."executor_adapter" AS ENUM('LOCAL_ENROLLED_RUNNER', 'RENTAHUMAN');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('SUBMITTED', 'CONFIRMED', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "public"."physical_task_status" AS ENUM('CREATED', 'DISPATCHED', 'ACCEPTED', 'SUBMITTED', 'COMPLETED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."physical_task_type" AS ENUM('PRINT_AND_COLLECT', 'PLACE_SPOT');--> statement-breakpoint
CREATE TYPE "public"."print_format" AS ENUM('A5', 'A6');--> statement-breakpoint
CREATE TYPE "public"."spot_outcome" AS ENUM('PENDING', 'PASS', 'MISS');--> statement-breakpoint
CREATE TABLE "brand_playbooks" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"version" integer NOT NULL,
	"approved_logo_url" text,
	"approved_tagline" text,
	"default_print_format" "print_format" NOT NULL,
	"default_evidence_policy" "evidence_policy" NOT NULL,
	"max_autonomous_physical_spend_minor" bigint NOT NULL,
	"currency" "currency" NOT NULL,
	"forbidden_claims" text[] NOT NULL,
	"notes" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_playbooks_brand_version_unique" UNIQUE("brand_id","version"),
	CONSTRAINT "brand_playbooks_version_positive" CHECK ("brand_playbooks"."version" >= 1),
	CONSTRAINT "brand_playbooks_spend_non_negative" CHECK ("brand_playbooks"."max_autonomous_physical_spend_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"version" integer NOT NULL,
	"asset_version" integer NOT NULL,
	"asset_hash" text NOT NULL,
	"spots_hash" text NOT NULL,
	"budget_minor" bigint NOT NULL,
	"currency" "currency" NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"evidence_policy" "evidence_policy" NOT NULL,
	"approved_by" text NOT NULL,
	"approved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "approvals_campaign_version_unique" UNIQUE("campaign_id","version"),
	CONSTRAINT "approvals_version_positive" CHECK ("approvals"."version" >= 1),
	CONSTRAINT "approvals_asset_version_positive" CHECK ("approvals"."asset_version" >= 1),
	CONSTRAINT "approvals_budget_positive" CHECK ("approvals"."budget_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"buyer_ref" text,
	"brand_id" text NOT NULL,
	"brand_playbook_version" integer,
	"message" text NOT NULL,
	"destination_url" text NOT NULL,
	"status" "campaign_status" DEFAULT 'DRAFT' NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"budget_minor" bigint NOT NULL,
	"currency" "currency" NOT NULL,
	"approved_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"canonical_result_hash" text,
	"sokosumi_task_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_sokosumi_task_unique" UNIQUE("sokosumi_task_id"),
	CONSTRAINT "campaigns_budget_positive" CHECK ("campaigns"."budget_minor" > 0),
	CONSTRAINT "campaigns_completed_has_time" CHECK ("campaigns"."status" <> 'COMPLETED' or "campaigns"."completed_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "spots" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"instructions" text NOT NULL,
	"qr_target_url" text NOT NULL,
	"asset_url" text,
	"status" "spot_outcome" DEFAULT 'PENDING' NOT NULL,
	"first_pass_status" "spot_outcome" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spots_campaign_code_unique" UNIQUE("campaign_id","code")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"sequence" bigint GENERATED ALWAYS AS IDENTITY (sequence name "audit_events_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"campaign_id" text NOT NULL,
	"type" "audit_event_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_events" (
	"id" text PRIMARY KEY NOT NULL,
	"spot_id" text NOT NULL,
	"user_agent" text,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"physical_task_id" text NOT NULL,
	"spot_id" text,
	"content_hash" text NOT NULL,
	"photo_url" text NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"decoded_campaign_id" text,
	"decoded_spot_code" text,
	"optional_geo" jsonb,
	"checks" jsonb,
	"verdict" "evidence_verdict",
	"failure" "evidence_failure",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_task_content_unique" UNIQUE("physical_task_id","content_hash"),
	CONSTRAINT "evidence_content_hash_is_sha256" CHECK ("evidence"."content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "evidence_failure_only_on_fail" CHECK (coalesce("evidence"."verdict" = 'FAIL', false) = ("evidence"."failure" is not null)),
	CONSTRAINT "evidence_verdict_has_checks" CHECK (("evidence"."verdict" is null) = ("evidence"."checks" is null))
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"physical_task_id" text NOT NULL,
	"receipt_url" text NOT NULL,
	"merchant" text,
	"amount_minor" bigint NOT NULL,
	"currency" "currency" NOT NULL,
	"status" "expense_status" DEFAULT 'SUBMITTED' NOT NULL,
	"ocr" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "physical_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"spot_id" text,
	"type" "physical_task_type" NOT NULL,
	"adapter" "executor_adapter" NOT NULL,
	"attempt" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"external_task_ref" text,
	"status" "physical_task_status" DEFAULT 'CREATED' NOT NULL,
	"instructions" text NOT NULL,
	"asset_urls" text[] NOT NULL,
	"estimated_cost_minor" bigint NOT NULL,
	"committed_cost_minor" bigint DEFAULT 0 NOT NULL,
	"currency" "currency" NOT NULL,
	"due_by" timestamp with time zone NOT NULL,
	"runner_token_hash" text,
	"runner_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "physical_tasks_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "physical_tasks_runner_token_hash_unique" UNIQUE("runner_token_hash"),
	CONSTRAINT "physical_tasks_attempt_positive" CHECK ("physical_tasks"."attempt" >= 1),
	CONSTRAINT "physical_tasks_costs_non_negative" CHECK ("physical_tasks"."estimated_cost_minor" >= 0 and "physical_tasks"."committed_cost_minor" >= 0),
	CONSTRAINT "physical_tasks_runner_token_is_hash" CHECK ("physical_tasks"."runner_token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "physical_tasks_runner_token_expires" CHECK (("physical_tasks"."runner_token_hash" is null) = ("physical_tasks"."runner_token_expires_at" is null))
);
--> statement-breakpoint
CREATE TABLE "masumi_payment_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text,
	"sokosumi_task_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"blockchain_identifier" text NOT NULL,
	"result_hash" text NOT NULL,
	"seller_address" text NOT NULL,
	"token_unit" text NOT NULL,
	"collection_tx_hash" text,
	"net_received_atomic" text,
	"collection_confirmed" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "masumi_payment_evidence_task_unique" UNIQUE("sokosumi_task_id"),
	CONSTRAINT "masumi_payment_net_received_is_integer" CHECK ("masumi_payment_evidence"."net_received_atomic" ~ '^[0-9]+$'),
	CONSTRAINT "masumi_payment_confirmed_has_proof" CHECK (not "masumi_payment_evidence"."collection_confirmed" or ("masumi_payment_evidence"."collection_tx_hash" is not null and "masumi_payment_evidence"."net_received_atomic" is not null and "masumi_payment_evidence"."verified_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "brand_playbooks" ADD CONSTRAINT "brand_playbooks_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brand_playbook_fk" FOREIGN KEY ("brand_id","brand_playbook_version") REFERENCES "public"."brand_playbooks"("brand_id","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spots" ADD CONSTRAINT "spots_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_physical_task_id_physical_tasks_id_fk" FOREIGN KEY ("physical_task_id") REFERENCES "public"."physical_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_physical_task_id_physical_tasks_id_fk" FOREIGN KEY ("physical_task_id") REFERENCES "public"."physical_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physical_tasks" ADD CONSTRAINT "physical_tasks_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physical_tasks" ADD CONSTRAINT "physical_tasks_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "masumi_payment_evidence" ADD CONSTRAINT "masumi_payment_evidence_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brands_name_unique" ON "brands" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_events_campaign_sequence_idx" ON "audit_events" USING btree ("campaign_id","sequence");--> statement-breakpoint
CREATE INDEX "scan_events_spot_idx" ON "scan_events" USING btree ("spot_id");--> statement-breakpoint
CREATE INDEX "evidence_spot_idx" ON "evidence" USING btree ("spot_id");--> statement-breakpoint
CREATE INDEX "expenses_campaign_idx" ON "expenses" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "physical_tasks_campaign_idx" ON "physical_tasks" USING btree ("campaign_id");