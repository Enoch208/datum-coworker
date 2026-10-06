import { asc, eq } from "drizzle-orm";
import type { AuditEventType } from "@datum/core";
import { auditEvents, type Executor } from "@datum/db";
import { toAuditEventView } from "../views/timeline";

export async function recordAudit(
  db: Executor,
  campaignId: string,
  type: AuditEventType,
  payload: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditEvents).values({ campaignId, type, payload });
}

export async function auditTrail(db: Executor, campaignId: string) {
  const rows = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.campaignId, campaignId))
    .orderBy(asc(auditEvents.sequence));
  return rows.map(toAuditEventView);
}
