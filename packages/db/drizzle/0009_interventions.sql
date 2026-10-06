CREATE TYPE "public"."intervention_action" AS ENUM('BUDGET_RAISED', 'EXPENSE_ACCEPTED');--> statement-breakpoint
CREATE TYPE "public"."intervention_actor" AS ENUM('CUSTOMER', 'OPERATOR');--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'INTERVENTION_RECORDED' BEFORE 'RECEIPT_PUBLISHED';--> statement-breakpoint
CREATE TABLE "interventions" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"actor" "intervention_actor" NOT NULL,
	"actor_name" text NOT NULL,
	"action" "intervention_action" NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interventions_reason_present" CHECK (length(trim("interventions"."reason")) > 0),
	CONSTRAINT "interventions_actor_name_present" CHECK (length(trim("interventions"."actor_name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interventions_campaign_idx" ON "interventions" USING btree ("campaign_id");