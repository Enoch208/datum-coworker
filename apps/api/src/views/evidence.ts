import { evidenceCheckView, type EvidenceView } from "@datum/core";
import type { EvidenceRow } from "@datum/db";
import { evidenceFileUrl } from "../uploads/files";

export function toEvidenceView(
  row: EvidenceRow,
  spotCode: string | null,
  appBaseUrl: string,
): EvidenceView {
  if (row.checks === null) throw new Error(`Evidence ${row.id} was stored without its checks`);
  return {
    id: row.id,
    taskId: row.physicalTaskId,
    spotCode,
    photoUrl: evidenceFileUrl(appBaseUrl, row.photoFile),
    submittedAt: row.submittedAt.toISOString(),
    verdict: row.verdict,
    failure: row.failure,
    explanation: row.explanation,
    checks: evidenceCheckView(row.checks),
  };
}

export const deciding = (rows: readonly EvidenceRow[]): EvidenceRow | null =>
  rows.findLast((row) => row.verdict === "PASS") ?? rows.at(-1) ?? null;
