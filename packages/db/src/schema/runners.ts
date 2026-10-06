import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text } from "drizzle-orm/pg-core";
import { createdAt, instant, primaryId } from "./columns";

export const runners = pgTable(
  "runners",
  {
    id: primaryId("rnr"),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    inboxTokenHash: text("inbox_token_hash").notNull().unique("runners_inbox_token_hash_unique"),
    tokenExpiresAt: instant("token_expires_at").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    check("runners_inbox_token_is_hash", sql`${table.inboxTokenHash} ~ '^[0-9a-f]{64}$'`),
    check("runners_name_present", sql`length(trim(${table.name})) > 0`),
  ],
);
