import { bigint, index, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { campaigns, spots } from "./campaigns";
import { createdAt, instant, primaryId } from "./columns";
import { auditEventType } from "./enums";

export const auditEvents = pgTable(
  "audit_events",
  {
    id: primaryId("evt"),
    sequence: bigint("sequence", { mode: "number" }).generatedAlwaysAsIdentity(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    type: auditEventType("type").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("audit_events_campaign_sequence_idx").on(table.campaignId, table.sequence)],
);

export const scanEvents = pgTable(
  "scan_events",
  {
    id: primaryId("scn"),
    spotId: text("spot_id")
      .notNull()
      .references(() => spots.id),
    userAgent: text("user_agent"),
    scannedAt: instant("scanned_at").notNull().defaultNow(),
  },
  (table) => [index("scan_events_spot_idx").on(table.spotId)],
);
