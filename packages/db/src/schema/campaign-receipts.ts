import { sql } from "drizzle-orm";
import { check, pgTable, text } from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns";
import { instant, primaryId } from "./columns";
import { campaignStatus } from "./enums";

export const campaignReceipts = pgTable(
  "campaign_receipts",
  {
    id: primaryId("rct"),
    campaignId: text("campaign_id")
      .notNull()
      .unique("campaign_receipts_campaign_unique")
      .references(() => campaigns.id),
    status: campaignStatus("status").notNull(),
    canonicalJson: text("canonical_json").notNull(),
    sha256: text("sha256").notNull(),
    publishedAt: instant("published_at").notNull().defaultNow(),
  },
  (table) => [
    check("campaign_receipts_sha256_is_hex", sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
    check(
      "campaign_receipts_terminal_status",
      sql`${table.status} in ('COMPLETED', 'EXPIRED_INCOMPLETE', 'FAILED', 'CANCELLED')`,
    ),
  ],
);
