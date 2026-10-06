import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { createdAt, minorUnits, primaryId } from "./columns";
import { currency, evidencePolicy, printFormat } from "./enums";

export const brands = pgTable(
  "brands",
  {
    id: primaryId("brd"),
    name: text("name").notNull(),
    website: text("website"),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("brands_name_unique").on(sql`lower(${table.name})`)],
);

export const brandPlaybooks = pgTable(
  "brand_playbooks",
  {
    id: primaryId("pbk"),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id),
    version: integer("version").notNull(),
    approvedLogoUrl: text("approved_logo_url"),
    approvedTagline: text("approved_tagline"),
    defaultPrintFormat: printFormat("default_print_format").notNull(),
    defaultEvidencePolicy: evidencePolicy("default_evidence_policy").notNull(),
    maxAutonomousPhysicalSpendMinor: minorUnits("max_autonomous_physical_spend_minor").notNull(),
    currency: currency("currency").notNull(),
    forbiddenClaims: text("forbidden_claims").array().notNull(),
    notes: text("notes").array().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique("brand_playbooks_brand_version_unique").on(table.brandId, table.version),
    check("brand_playbooks_version_positive", sql`${table.version} >= 1`),
    check("brand_playbooks_spend_non_negative", sql`${table.maxAutonomousPhysicalSpendMinor} >= 0`),
  ],
);
