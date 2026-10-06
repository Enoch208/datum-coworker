import { asc, eq } from "drizzle-orm";
import type { CampaignStatus, Money, TimelineEventView } from "@datum/core";
import { auditEvents, type Executor } from "@datum/db";
import { toTimelineEvent } from "../views/timeline";

export type AuditEvent =
  | {
      type: "CAMPAIGN_CREATED";
      payload: { brandId: string; spotCodes: string[]; budget: Money; deadline: string };
    }
  | { type: "STATUS_CHANGED"; payload: { from: CampaignStatus; to: CampaignStatus } }
  | {
      type: "PLAYBOOK_DRAFTED";
      payload: {
        brandId: string;
        version: number;
        reused: boolean;
        brandPage: "READ" | "NOT_GIVEN" | "FAILED" | null;
      };
    }
  | { type: "PLAN_REJECTED"; payload: { model: string; reason: string; detail: string } }
  | {
      type: "PLAN_GENERATED";
      payload: { model: string; assetVersion: number; headline: string; steps: number };
    }
  | {
      type: "PLAN_VALIDATED";
      payload: { assetVersion: number; estimatedSpend: Money; budget: Money; overBudget: boolean };
    }
  | {
      type: "CARDS_RENDERED";
      payload: { assetVersion: number; assetHash: string; spotCodes: string[] };
    }
  | {
      type: "COPY_EDITED";
      payload: { fromVersion: number; assetVersion: number; supersededApproval: number | null };
    }
  | {
      type: "CAMPAIGN_APPROVED";
      payload: {
        approvalVersion: number;
        assetVersion: number;
        assetHash: string;
        spotsHash: string;
        approvedBy: string;
        budget: Money;
        deadline: string;
      };
    };

export async function recordAudit(
  db: Executor,
  campaignId: string,
  event: AuditEvent,
): Promise<void> {
  await db.insert(auditEvents).values({ campaignId, type: event.type, payload: event.payload });
}

export async function auditTrail(db: Executor, campaignId: string): Promise<TimelineEventView[]> {
  const rows = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.campaignId, campaignId))
    .orderBy(asc(auditEvents.sequence));
  return rows.map(toTimelineEvent);
}
