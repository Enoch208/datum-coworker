import { sql } from "drizzle-orm";
import { check, index, pgTable, text } from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns";
import { createdAt, primaryId } from "./columns";
import { interventionAction, interventionActor } from "./enums";

export const interventions = pgTable(
  "interventions",
  {
    id: primaryId("itv"),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    actor: interventionActor("actor").notNull(),
    actorName: text("actor_name").notNull(),
    action: interventionAction("action").notNull(),
    reason: text("reason").notNull(),
    ownerStatement: text("owner_statement"),
    ownerSignature: text("owner_signature"),
    createdAt: createdAt(),
  },
  (table) => [
    check("interventions_reason_present", sql`length(trim(${table.reason})) > 0`),
    check("interventions_actor_name_present", sql`length(trim(${table.actorName})) > 0`),
    index("interventions_campaign_idx").on(table.campaignId),
  ],
);
