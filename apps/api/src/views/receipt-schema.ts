import {
  campaignStatuses,
  currencies,
  executorAdapters,
  expenseKinds,
  interventionActions,
  interventionActors,
  recoverySources,
  spotOutcomes,
  type CampaignReceipt,
} from "@datum/core";
import { z } from "zod";

const money = z.strictObject({ amountMinor: z.int(), currency: z.enum(currencies) });
const instant = z.string();

const spotLine = z.strictObject({
  spotCode: z.string(),
  name: z.string(),
  firstPass: z.enum(spotOutcomes),
  final: z.enum(spotOutcomes),
  attempts: z.int(),
  inducedMiss: z.boolean(),
  scans: z.int(),
  evidencePhotoUrl: z.string().nullable(),
  passedAt: instant.nullable(),
});

const recovery = z.strictObject({
  round: z.int(),
  source: z.enum(recoverySources),
  idempotencyKey: z.string(),
  spotCodes: z.array(z.string()),
  tasks: z.array(
    z.strictObject({ spotCode: z.string(), attempt: z.int(), idempotencyKey: z.string() }),
  ),
  estimatedCost: money,
  dispatchedAt: instant,
});

const intervention = z.strictObject({
  at: instant,
  actor: z.enum(interventionActors),
  actorName: z.string(),
  action: z.enum(interventionActions),
  reason: z.string(),
});

const spendLine = z.strictObject({
  taskId: z.string(),
  kind: z.enum(expenseKinds),
  label: z.string(),
  amount: money,
});

const masumi = z.strictObject({
  sokosumiTaskId: z.string(),
  paymentId: z.string(),
  blockchainIdentifier: z.string(),
  resultHash: z.string(),
  sellerAddress: z.string(),
  tokenUnit: z.string(),
  escrowTxHash: z.string().nullable(),
  resultTxHash: z.string().nullable(),
  collectionTxHash: z.string().nullable(),
  netReceivedAtomic: z.string().nullable(),
  collectionConfirmed: z.boolean(),
  verifiedAt: instant.nullable(),
});

export const campaignReceiptSchema = z.strictObject({
  campaignId: z.string(),
  campaignName: z.string(),
  status: z.enum(campaignStatuses),
  target: z.strictObject({ spots: z.int(), deadline: instant, budget: money }),
  actual: z.strictObject({
    spotsPassed: z.int(),
    completedAt: instant.nullable(),
    spend: money,
  }),
  spots: z.array(spotLine),
  firstPassPassed: z.int(),
  recoveryActions: z.int(),
  recoveries: z.array(recovery),
  postApprovalInterventions: z.int(),
  interventions: z.array(intervention),
  spendLines: z.array(spendLine),
  executorAdapters: z.array(z.enum(executorAdapters)),
  totalScans: z.int(),
  masumi: masumi.nullable(),
}) satisfies z.ZodType<CampaignReceipt>;
