ALTER TYPE "public"."audit_event_type" ADD VALUE 'PLAYBOOK_DRAFTED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'PLAN_REJECTED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'PLAN_VALIDATED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'CARDS_RENDERED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'COPY_EDITED';--> statement-breakpoint
CREATE TABLE "campaign_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"version" integer NOT NULL,
	"template_version" integer NOT NULL,
	"headline" text NOT NULL,
	"subcopy" text NOT NULL,
	"print_format" "print_format" NOT NULL,
	"steps" jsonb NOT NULL,
	"estimated_spend_minor" bigint NOT NULL,
	"currency" "currency" NOT NULL,
	"assumptions" text[] NOT NULL,
	"customer_warnings" text[] NOT NULL,
	"planned_by_model" text NOT NULL,
	"asset_hash" text NOT NULL,
	"spots_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_assets_campaign_version_unique" UNIQUE("campaign_id","version"),
	CONSTRAINT "campaign_assets_version_positive" CHECK ("campaign_assets"."version" >= 1),
	CONSTRAINT "campaign_assets_spend_non_negative" CHECK ("campaign_assets"."estimated_spend_minor" >= 0),
	CONSTRAINT "campaign_assets_asset_hash_is_sha256" CHECK ("campaign_assets"."asset_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "campaign_assets_spots_hash_is_sha256" CHECK ("campaign_assets"."spots_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "approved_headline" text NOT NULL;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "approved_subcopy" text NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_assets" ADD CONSTRAINT "campaign_assets_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_campaign_asset_fk" FOREIGN KEY ("campaign_id","asset_version") REFERENCES "public"."campaign_assets"("campaign_id","version") ON DELETE no action ON UPDATE no action;