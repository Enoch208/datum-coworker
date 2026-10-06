import type { AuditEventRow } from "@datum/db";

export function toAuditEventView(event: AuditEventRow) {
  return {
    id: event.id,
    type: event.type,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  };
}
