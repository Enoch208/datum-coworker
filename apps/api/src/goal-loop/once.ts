import { isDeepStrictEqual } from "node:util";
import { and, desc, eq } from "drizzle-orm";
import { auditEvents, type Executor } from "@datum/db";
import { recordAudit, type AuditEvent } from "../services/audit";

export async function recordUnlessRepeated(
  db: Executor,
  campaignId: string,
  event: AuditEvent,
): Promise<void> {
  const [latest] = await db
    .select({ payload: auditEvents.payload })
    .from(auditEvents)
    .where(and(eq(auditEvents.campaignId, campaignId), eq(auditEvents.type, event.type)))
    .orderBy(desc(auditEvents.sequence))
    .limit(1);
  if (latest !== undefined && isDeepStrictEqual(latest.payload, event.payload)) return;
  await recordAudit(db, campaignId, event);
}
