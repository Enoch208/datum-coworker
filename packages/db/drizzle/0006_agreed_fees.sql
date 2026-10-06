CREATE TYPE "public"."expense_kind" AS ENUM('RECEIPT', 'AGREED_FEE');--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "receipt_file" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "content_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "kind" "expense_kind" DEFAULT 'RECEIPT' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_receipt_has_image" CHECK (("expenses"."kind" = 'RECEIPT') = ("expenses"."receipt_file" is not null and "expenses"."content_hash" is not null));