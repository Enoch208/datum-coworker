ALTER TABLE "masumi_payment_evidence" ADD COLUMN "escrow_tx_hash" text;--> statement-breakpoint
ALTER TABLE "masumi_payment_evidence" ADD COLUMN "result_tx_hash" text;--> statement-breakpoint
ALTER TABLE "masumi_payment_evidence" ADD CONSTRAINT "masumi_payment_escrow_tx_is_hash" CHECK ("masumi_payment_evidence"."escrow_tx_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "masumi_payment_evidence" ADD CONSTRAINT "masumi_payment_result_tx_is_hash" CHECK ("masumi_payment_evidence"."result_tx_hash" ~ '^[0-9a-f]{64}$');