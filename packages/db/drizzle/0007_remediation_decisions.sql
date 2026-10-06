ALTER TYPE "public"."audit_event_type" ADD VALUE 'REMEDIATION_PROPOSED' BEFORE 'RECOVERY_CREATED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'REMEDIATION_FALLBACK' BEFORE 'RECOVERY_CREATED';--> statement-breakpoint
CREATE TABLE "remediation_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"round" integer NOT NULL,
	"gaps" jsonb NOT NULL,
	"planner_model" text,
	"proposal" jsonb,
	"planner_failure" jsonb,
	"proposal_verdict" jsonb,
	"fallback_used" boolean NOT NULL,
	"verdict" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "remediation_decisions_round_unique" UNIQUE("campaign_id","round"),
	CONSTRAINT "remediation_decisions_round_positive" CHECK ("remediation_decisions"."round" >= 1),
	CONSTRAINT "remediation_decisions_proposal_or_failure" CHECK (("remediation_decisions"."proposal" is null) or ("remediation_decisions"."planner_failure" is null))
);
--> statement-breakpoint
ALTER TABLE "remediation_decisions" ADD CONSTRAINT "remediation_decisions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "remediation_decisions_campaign_idx" ON "remediation_decisions" USING btree ("campaign_id","round");