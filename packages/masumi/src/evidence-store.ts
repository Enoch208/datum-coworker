import { and, eq } from "drizzle-orm";
import type { MasumiPaymentEvidence } from "@datum/core";
import { masumiPaymentEvidence, type Db } from "@datum/db";
import { TerminalLifecycleError } from "./errors";

export type EvidenceDraft = Pick<
  MasumiPaymentEvidence,
  | "sokosumiTaskId"
  | "paymentId"
  | "blockchainIdentifier"
  | "resultHash"
  | "sellerAddress"
  | "tokenUnit"
>;

export interface CollectionRecord {
  readonly collectionTxHash: string;
  readonly netReceivedAtomic: string;
  readonly verifiedAt: Date;
}

export interface EvidenceStore {
  record(draft: EvidenceDraft): Promise<void>;
  confirmCollection(draft: EvidenceDraft, collection: CollectionRecord): Promise<void>;
}

const draftKeys = [
  "sokosumiTaskId",
  "paymentId",
  "blockchainIdentifier",
  "resultHash",
  "sellerAddress",
  "tokenUnit",
] as const satisfies readonly (keyof EvidenceDraft)[];

export function draftDifferences(stored: EvidenceDraft, draft: EvidenceDraft): string[] {
  return draftKeys.filter((key) => stored[key] !== draft[key]);
}

export function createDbEvidenceStore(db: Db): EvidenceStore {
  const forTask = (draft: EvidenceDraft) =>
    and(
      eq(masumiPaymentEvidence.sokosumiTaskId, draft.sokosumiTaskId),
      eq(masumiPaymentEvidence.blockchainIdentifier, draft.blockchainIdentifier),
    );

  return {
    async record(draft) {
      await db
        .insert(masumiPaymentEvidence)
        .values(draft)
        .onConflictDoNothing({ target: masumiPaymentEvidence.sokosumiTaskId });
      const [stored] = await db
        .select()
        .from(masumiPaymentEvidence)
        .where(eq(masumiPaymentEvidence.sokosumiTaskId, draft.sokosumiTaskId));
      if (stored === undefined) {
        throw new Error(`Payment evidence for Task ${draft.sokosumiTaskId} was not stored`);
      }
      const differences = draftDifferences(stored, draft);
      if (differences.length > 0) {
        throw new TerminalLifecycleError(
          `Task ${draft.sokosumiTaskId} already has payment evidence that differs in ${differences.join(", ")}`,
        );
      }
    },
    async confirmCollection(draft, collection) {
      const updated = await db
        .update(masumiPaymentEvidence)
        .set({ ...collection, collectionConfirmed: true })
        .where(forTask(draft))
        .returning({ id: masumiPaymentEvidence.id });
      if (updated.length !== 1) {
        throw new TerminalLifecycleError(
          `No payment evidence row for Task ${draft.sokosumiTaskId} to confirm`,
        );
      }
    },
  };
}
