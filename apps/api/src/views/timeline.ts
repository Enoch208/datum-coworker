import {
  campaignStatuses,
  formatMoney,
  type CampaignStatus,
  type TimelineEventView,
} from "@datum/core";
import type { AuditEventRow } from "@datum/db";
import { z } from "zod";
import { describe, moneyPayload as money, plural, type Describers } from "./describe";
import { executionDescribers } from "./timeline-execution";
import { loopDescribers } from "./timeline-loop";

const status = z.enum(campaignStatuses);

const playbookSources = {
  READ: "the brand name, the message and the brand page",
  NOT_GIVEN: "the brand name and the message",
  FAILED: "the brand name and the message; the brand page could not be read",
};

const statusMeanings: Partial<Record<CampaignStatus, string>> = {
  EXECUTING: "the physical work is under way",
  VERIFYING: "Datum is checking the evidence against the goal",
  REMEDIATING: "Datum is planning how to recover the unresolved spots",
  NEEDS_APPROVAL: "Datum stopped at the edge of its authority and needs the customer",
  COMPLETED: "every approved spot is live",
  EXPIRED_INCOMPLETE: "the deadline passed with spots unresolved",
};

const planningDescribers: Describers = {
  CAMPAIGN_CREATED: describe(
    z.object({ spotCodes: z.array(z.string()), budget: money, deadline: z.string() }),
    "CUSTOMER",
    (p) =>
      `Campaign created for ${plural(p.spotCodes.length, "spot")} (${p.spotCodes.join(", ")}) with a ${formatMoney(p.budget)} budget, due ${p.deadline}`,
  ),
  STATUS_CHANGED: describe(z.object({ from: status, to: status }), "DATUM_RULES", (p) => {
    const meaning = statusMeanings[p.to];
    return `Status moved from ${p.from} to ${p.to}${meaning === undefined ? "" : `: ${meaning}`}`;
  }),
  PLAYBOOK_DRAFTED: describe(
    z.object({
      version: z.int(),
      reused: z.boolean(),
      brandPage: z.enum(["READ", "NOT_GIVEN", "FAILED"]).nullable(),
    }),
    "DATUM_RULES",
    (p) =>
      p.reused || p.brandPage === null
        ? `Reused Brand Playbook v${String(p.version)}`
        : `Drafted Brand Playbook v${String(p.version)} from ${playbookSources[p.brandPage]}`,
  ),
  PLAN_REJECTED: describe(
    z.object({ model: z.string(), reason: z.string(), detail: z.string() }),
    "DATUM_RULES",
    (p) => `Rules rejected the plan from ${p.model} (${p.reason}): ${p.detail}`,
  ),
  PLAN_GENERATED: describe(
    z.object({ model: z.string(), assetVersion: z.int(), headline: z.string(), steps: z.int() }),
    "DATUM_AI",
    (p) =>
      `${p.model} drafted proposal v${String(p.assetVersion)} with ${plural(p.steps, "step")}: "${p.headline}"`,
  ),
  PLAN_VALIDATED: describe(
    z.object({
      assetVersion: z.int(),
      estimatedSpend: money,
      budget: money,
      overBudget: z.boolean(),
    }),
    "DATUM_RULES",
    (p) =>
      `Rules accepted proposal v${String(p.assetVersion)} and estimated ${formatMoney(p.estimatedSpend)} against the ${formatMoney(p.budget)} budget${p.overBudget ? ", which is over budget" : ""}`,
  ),
  CARDS_RENDERED: describe(
    z.object({ assetVersion: z.int(), assetHash: z.string(), spotCodes: z.array(z.string()) }),
    "DATUM_RULES",
    (p) =>
      `Rendered ${plural(p.spotCodes.length, "printable card")} for proposal v${String(p.assetVersion)}, each with its own QR (asset ${p.assetHash.slice(0, 12)})`,
  ),
  COPY_EDITED: describe(
    z.object({
      fromVersion: z.int(),
      assetVersion: z.int(),
      supersededApproval: z.int().nullable(),
    }),
    "CUSTOMER",
    (p) =>
      `Customer edited the copy of proposal v${String(p.fromVersion)}, creating v${String(p.assetVersion)}${p.supersededApproval === null ? "" : `; approval v${String(p.supersededApproval)} no longer applies`}`,
  ),
  CAMPAIGN_APPROVED: describe(
    z.object({
      approvedBy: z.string(),
      assetVersion: z.int(),
      budget: money,
      deadline: z.string(),
    }),
    "CUSTOMER",
    (p) =>
      `${p.approvedBy} approved proposal v${String(p.assetVersion)} with a ${formatMoney(p.budget)} budget, due ${p.deadline}`,
  ),
};

export const timelineDescribers: Describers = {
  ...planningDescribers,
  ...executionDescribers,
  ...loopDescribers,
};

export function toTimelineEvent(event: AuditEventRow): TimelineEventView {
  const describer = timelineDescribers[event.type];
  if (describer === undefined) {
    throw new Error(
      `Audit event ${event.id} has type ${event.type}, which the timeline cannot describe`,
    );
  }
  return {
    id: event.id,
    type: event.type,
    ...describer(event.payload),
    at: event.createdAt.toISOString(),
  };
}
