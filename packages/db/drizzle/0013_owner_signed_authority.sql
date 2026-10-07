ALTER TABLE "campaigns" ADD COLUMN "owner_public_key" text;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "owner_statement" text;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "owner_signature" text;--> statement-breakpoint
ALTER TABLE "interventions" ADD COLUMN "owner_statement" text;--> statement-breakpoint
ALTER TABLE "interventions" ADD COLUMN "owner_signature" text;