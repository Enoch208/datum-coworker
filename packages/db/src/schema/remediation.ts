import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, unique } from "drizzle-orm/pg-core";
import type { ChosenRecovery, RemediationGaps, VerdictSummary } from "@datum/core";
import { campaigns } from "./campaigns";
import { createdAt, instant, primaryId } from "./columns";

export interface ProposedRecoveryAction {
  spotCodes: string[];
  dueInMinutes: number;
  runnerNote: string;
}

export interface RecoveryProposal {
  actions: ProposedRecoveryAction[];
  rationale: string;
}

export interface PlannerFailureRecord {
  code: string;
  detail: string;
}

export const remediationDecisions = pgTable(
  "remediation_decisions",
  {
    id: primaryId("rmd"),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    round: integer("round").notNull(),
    gaps: jsonb("gaps").$type<RemediationGaps>().notNull(),
    plannerModel: text("planner_model"),
    proposal: jsonb("proposal").$type<RecoveryProposal>(),
    plannerFailure: jsonb("planner_failure").$type<PlannerFailureRecord>(),
    proposalVerdict: jsonb("proposal_verdict").$type<VerdictSummary>(),
    fallbackUsed: boolean("fallback_used").notNull(),
    verdict: jsonb("verdict").$type<VerdictSummary>().notNull(),
    actions: jsonb("actions").$type<ChosenRecovery[]>().notNull(),
    appliedAt: instant("applied_at"),
    createdAt: createdAt(),
  },
  (table) => [
    unique("remediation_decisions_round_unique").on(table.campaignId, table.round),
    check("remediation_decisions_round_positive", sql`${table.round} >= 1`),
    check(
      "remediation_decisions_proposal_or_failure",
      sql`(${table.proposal} is null) or (${table.plannerFailure} is null)`,
    ),
    index("remediation_decisions_campaign_idx").on(table.campaignId, table.round),
  ],
);
