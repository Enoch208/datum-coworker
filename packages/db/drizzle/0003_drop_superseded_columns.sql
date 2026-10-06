ALTER TABLE "physical_tasks" DROP CONSTRAINT "physical_tasks_runner_token_hash_unique";--> statement-breakpoint
ALTER TABLE "physical_tasks" DROP CONSTRAINT "physical_tasks_runner_token_is_hash";--> statement-breakpoint
ALTER TABLE "physical_tasks" DROP CONSTRAINT "physical_tasks_runner_token_expires";--> statement-breakpoint
ALTER TABLE "physical_tasks" DROP COLUMN "runner_token_hash";--> statement-breakpoint
ALTER TABLE "physical_tasks" DROP COLUMN "runner_token_expires_at";--> statement-breakpoint
ALTER TABLE "evidence" DROP COLUMN "photo_url";--> statement-breakpoint
ALTER TABLE "expenses" DROP COLUMN "receipt_url";