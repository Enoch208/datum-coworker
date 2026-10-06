CREATE TABLE "campaign_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"status" "campaign_status" NOT NULL,
	"canonical_json" text NOT NULL,
	"sha256" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_receipts_campaign_unique" UNIQUE("campaign_id"),
	CONSTRAINT "campaign_receipts_sha256_is_hex" CHECK ("campaign_receipts"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "campaign_receipts_terminal_status" CHECK ("campaign_receipts"."status" in ('COMPLETED', 'EXPIRED_INCOMPLETE', 'FAILED', 'CANCELLED'))
);
--> statement-breakpoint
ALTER TABLE "spots" ADD COLUMN "induced_miss" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_receipts" ADD CONSTRAINT "campaign_receipts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;