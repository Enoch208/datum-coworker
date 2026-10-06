import {
  auditEventTypes,
  campaignStatuses,
  evidencePolicies,
  printFormats,
  spotOutcomes,
  timelineActors,
  type ApiError,
  type ApprovalView,
  type CampaignView,
  type PlanStep,
  type PlaybookView,
  type ProposalView,
  type SpotView,
  type TimelineEventView,
} from "@datum/core";
import { z } from "zod";
import { evidenceSchema, ledgerSchema, taskSummarySchema } from "./execution-schemas";
import { instant, wireMoney } from "./wire-primitives";

const publicCopy = z.object({ headline: z.string(), subcopy: z.string() });

const planStep: z.ZodType<PlanStep> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PRINT_AND_COLLECT"),
    quantity: z.int().nonnegative(),
    estimatedCost: wireMoney,
  }),
  z.object({ type: z.literal("PLACE_SPOT"), spotCode: z.string(), estimatedCost: wireMoney }),
]);

const playbook: z.ZodType<PlaybookView> = z.object({
  brandId: z.string(),
  version: z.int(),
  website: z.string().nullable(),
  approvedLogoUrl: z.string().nullable(),
  approvedTagline: z.string().nullable(),
  defaultPrintFormat: z.enum(printFormats),
  maxAutonomousPhysicalSpend: wireMoney,
  forbiddenClaims: z.array(z.string()),
  notes: z.array(z.string()),
});

const proposal: z.ZodType<ProposalView> = z.object({
  assetVersion: z.int(),
  assetHash: z.string(),
  copy: publicCopy,
  printFormat: z.enum(printFormats),
  steps: z.array(planStep),
  estimatedSpend: wireMoney,
  evidencePolicy: z.enum(evidencePolicies),
  assumptions: z.array(z.string()),
  customerWarnings: z.array(z.string()),
  plannedBy: z.object({ model: z.string() }),
  createdAt: instant,
});

const spot: z.ZodType<SpotView> = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  instructions: z.string(),
  qrTargetUrl: z.string(),
  status: z.enum(spotOutcomes),
  firstPassStatus: z.enum(spotOutcomes),
  inducedMiss: z.boolean().exactOptional(),
  scanCount: z.int().nonnegative(),
  card: z.object({ pngUrl: z.string(), pdfUrl: z.string() }).nullable(),
  latestEvidence: evidenceSchema.nullable(),
});

const approval: z.ZodType<ApprovalView> = z.object({
  version: z.int(),
  assetVersion: z.int(),
  assetHash: z.string(),
  spotsHash: z.string(),
  copy: publicCopy,
  budget: wireMoney,
  deadline: instant,
  evidencePolicy: z.enum(evidencePolicies),
  approvedBy: z.string(),
  approvedAt: instant,
  current: z.boolean(),
});

export const campaignViewSchema: z.ZodType<CampaignView> = z.object({
  id: z.string().min(1),
  status: z.enum(campaignStatuses),
  brand: z.object({ id: z.string(), name: z.string(), website: z.string().nullable() }),
  message: z.string(),
  destinationUrl: z.string(),
  deadline: instant,
  budget: wireMoney,
  createdAt: instant,
  approvedAt: instant.nullable(),
  completedAt: instant.nullable(),
  playbook: playbook.nullable(),
  proposal: proposal.nullable(),
  approval: approval.nullable(),
  spots: z.array(spot),
  tasks: z.array(taskSummarySchema),
  ledger: ledgerSchema.nullable(),
});

export const timelineSchema: z.ZodType<TimelineEventView[]> = z.array(
  z.object({
    id: z.string(),
    type: z.enum(auditEventTypes),
    actor: z.enum(timelineActors),
    summary: z.string(),
    at: instant,
  }),
);

export const createdCampaignSchema = z.object({ id: z.string().min(1) });

export const apiErrorSchema: z.ZodType<ApiError> = z.object({
  error: z.string(),
  message: z.string(),
});
