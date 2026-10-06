import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text } from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns";
import { createdAt, instant, primaryId } from "./columns";

export const masumiPaymentEvidence = pgTable(
  "masumi_payment_evidence",
  {
    id: primaryId("pay"),
    campaignId: text("campaign_id").references(() => campaigns.id),
    sokosumiTaskId: text("sokosumi_task_id")
      .notNull()
      .unique("masumi_payment_evidence_task_unique"),
    paymentId: text("payment_id").notNull(),
    blockchainIdentifier: text("blockchain_identifier").notNull(),
    resultHash: text("result_hash").notNull(),
    sellerAddress: text("seller_address").notNull(),
    tokenUnit: text("token_unit").notNull(),
    collectionTxHash: text("collection_tx_hash"),
    netReceivedAtomic: text("net_received_atomic"),
    collectionConfirmed: boolean("collection_confirmed").notNull().default(false),
    verifiedAt: instant("verified_at"),
    createdAt: createdAt(),
  },
  (table) => [
    check("masumi_payment_net_received_is_integer", sql`${table.netReceivedAtomic} ~ '^[0-9]+$'`),
    check(
      "masumi_payment_confirmed_has_proof",
      sql`not ${table.collectionConfirmed} or (${table.collectionTxHash} is not null and ${table.netReceivedAtomic} is not null and ${table.verifiedAt} is not null)`,
    ),
  ],
);
