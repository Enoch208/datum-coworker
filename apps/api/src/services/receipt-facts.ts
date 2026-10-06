import { and, asc, eq, isNotNull } from "drizzle-orm";
import {
  isAfter,
  type ExecutorAdapter,
  type ReceiptFacts,
  type ReceiptRecovery,
  type ReceiptSpendLine,
  type SpotReceiptLine,
} from "@datum/core";
import {
  approvals,
  remediationDecisions,
  type EvidenceRow,
  type Executor,
  type ExpenseRow,
} from "@datum/db";
import { evidenceFileUrl } from "../uploads/files";
import type { CampaignParts, SpotWithScans } from "../views/campaigns";
import { toApprovalLock } from "../views/proposal";
import { budgetAffecting } from "./disputes";
import { campaignInterventions } from "./interventions";

const byTime = (left: EvidenceRow, right: EvidenceRow): number =>
  left.submittedAt.getTime() - right.submittedAt.getTime();

function spotLine(parts: CampaignParts, { spot, scans }: SpotWithScans, appBaseUrl: string) {
  const deadline = parts.campaign.deadline.toISOString();
  const photos = parts.evidence.filter((photo) => photo.spotId === spot.id).sort(byTime);
  const passing = photos.find(
    (photo) => photo.verdict === "PASS" && !isAfter(photo.submittedAt.toISOString(), deadline),
  );
  const shown = passing ?? photos.at(-1);
  const line: SpotReceiptLine = {
    spotCode: spot.code,
    name: spot.name,
    firstPass: spot.firstPassStatus,
    final: spot.status,
    attempts: parts.tasks.filter(({ task }) => task.spotId === spot.id).length,
    inducedMiss: spot.inducedMiss,
    scans,
    evidencePhotoUrl: shown === undefined ? null : evidenceFileUrl(appBaseUrl, shown.photoFile),
    passedAt: passing?.submittedAt.toISOString() ?? null,
  };
  return line;
}

const spendLine = (expense: ExpenseRow): ReceiptSpendLine => ({
  taskId: expense.physicalTaskId,
  kind: expense.kind,
  label: expense.merchant ?? "Print receipt",
  amount: { amountMinor: expense.amountMinor, currency: expense.currency },
});

async function recoveries(db: Executor, campaignId: string): Promise<ReceiptRecovery[]> {
  const applied = await db
    .select()
    .from(remediationDecisions)
    .where(
      and(
        eq(remediationDecisions.campaignId, campaignId),
        isNotNull(remediationDecisions.appliedAt),
      ),
    )
    .orderBy(asc(remediationDecisions.round));
  return applied.flatMap((decision) =>
    decision.actions.map((action) => ({
      round: decision.round,
      source: decision.fallbackUsed ? ("FALLBACK" as const) : ("MODEL" as const),
      idempotencyKey: action.idempotencyKey,
      spotCodes: action.spotCodes,
      tasks: action.tasks,
      estimatedCost: action.estimatedCost,
      dispatchedAt: (decision.appliedAt ?? decision.createdAt).toISOString(),
    })),
  );
}

async function firstApprovedAt(db: Executor, campaignId: string): Promise<string> {
  const [first] = await db
    .select({ approvedAt: approvals.approvedAt })
    .from(approvals)
    .where(eq(approvals.campaignId, campaignId))
    .orderBy(asc(approvals.version))
    .limit(1);
  if (first === undefined) throw new Error(`Campaign ${campaignId} has no approval`);
  return first.approvedAt.toISOString();
}

export async function receiptFacts(
  db: Executor,
  parts: CampaignParts,
  appBaseUrl: string,
): Promise<ReceiptFacts> {
  const { campaign, approval, brand } = parts;
  if (approval === null) throw new Error(`Campaign ${campaign.id} has no approval`);
  const expenses = budgetAffecting(parts.expenses);
  const adapters = new Set<ExecutorAdapter>(parts.tasks.map(({ task }) => task.adapter));
  return {
    campaignName: brand.name,
    status: campaign.status,
    approval: toApprovalLock(approval),
    spots: parts.spots.map((spot) => spotLine(parts, spot, appBaseUrl)),
    expenses: expenses.map((expense) => ({
      amount: { amountMinor: expense.amountMinor, currency: expense.currency },
      status: expense.status,
    })),
    completedAt: campaign.completedAt?.toISOString() ?? null,
    adaptersUsed: [...adapters],
    firstApprovedAt: await firstApprovedAt(db, campaign.id),
    interventions: (await campaignInterventions(db, campaign.id)).map((row) => ({
      at: row.createdAt.toISOString(),
      actor: row.actor,
      actorName: row.actorName,
      action: row.action,
      reason: row.reason,
    })),
    recoveries: await recoveries(db, campaign.id),
    spendLines: expenses.filter((expense) => expense.status === "CONFIRMED").map(spendLine),
    masumi: null,
  };
}
