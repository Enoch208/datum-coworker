import {
  campaignStatuses,
  executorAdapters,
  expenseKinds,
  interventionActions,
  interventionActors,
  recoverySources,
  spotOutcomes,
  type CampaignReceiptView,
  type MasumiProofView,
} from "@datum/core";
import { z } from "zod";
import { recoveryTaskKey } from "./goal-schemas";
import { instant, wireMoney } from "./wire-primitives";

const masumi: z.ZodType<MasumiProofView> = z.object({
  sokosumiTaskId: z.string(),
  paymentId: z.string(),
  blockchainIdentifier: z.string(),
  resultHash: z.string(),
  sellerAddress: z.string(),
  tokenUnit: z.string(),
  collectionTxHash: z.string().nullable(),
  netReceivedAtomic: z.string().nullable(),
  collectionConfirmed: z.boolean(),
  verifiedAt: instant.nullable(),
});

export const campaignReceiptSchema: z.ZodType<CampaignReceiptView> = z.object({
  campaignId: z.string(),
  campaignName: z.string(),
  status: z.enum(campaignStatuses),
  target: z.object({ spots: z.int(), deadline: instant, budget: wireMoney }),
  actual: z.object({ spotsPassed: z.int(), completedAt: instant.nullable(), spend: wireMoney }),
  firstPass: z.object({ passed: z.int(), required: z.int() }),
  spots: z.array(
    z.object({
      spotCode: z.string(),
      name: z.string(),
      firstPass: z.enum(spotOutcomes),
      final: z.enum(spotOutcomes),
      attempts: z.int().nonnegative(),
      recoveredAfterMiss: z.boolean(),
      inducedMiss: z.boolean(),
      scans: z.int().nonnegative(),
      evidencePhotoUrl: z.string().nullable(),
      passedAt: instant.nullable(),
    }),
  ),
  recoveryActions: z.int().nonnegative(),
  recoveries: z.array(
    z.object({
      round: z.int(),
      source: z.enum(recoverySources),
      idempotencyKey: z.string(),
      spotCodes: z.array(z.string()),
      tasks: z.array(recoveryTaskKey),
      estimatedCost: wireMoney,
      dispatchedAt: instant,
    }),
  ),
  postApprovalInterventions: z.int().nonnegative(),
  interventions: z.array(
    z.object({
      at: instant,
      actor: z.enum(interventionActors),
      actorName: z.string(),
      action: z.enum(interventionActions),
      reason: z.string(),
    }),
  ),
  spend: z.object({
    budget: wireMoney,
    confirmed: wireMoney,
    remaining: wireMoney,
    lines: z.array(
      z.object({
        taskId: z.string(),
        kind: z.enum(expenseKinds),
        label: z.string(),
        amount: wireMoney,
      }),
    ),
  }),
  executors: z.array(z.object({ adapter: z.enum(executorAdapters), label: z.string() })),
  totalScans: z.int().nonnegative(),
  publishedAt: instant,
  sha256: z.string(),
  masumi: masumi.nullable(),
});
