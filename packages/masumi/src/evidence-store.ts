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

export interface ChainReferences {
  readonly escrowTxHash: string;
  readonly resultTxHash: string | null;
}

export interface CollectionRecord {
  readonly collectionTxHash: string;
  readonly netReceivedAtomic: string;
  readonly verifiedAt: Date;
}

export interface EvidenceStore {
  record(draft: EvidenceDraft): Promise<void>;
  attachTransactions(draft: EvidenceDraft, references: ChainReferences): Promise<void>;
  confirmCollection(draft: EvidenceDraft, collection: CollectionRecord): Promise<void>;
}

type StoredReferences = Pick<MasumiPaymentEvidence, "escrowTxHash" | "resultTxHash">;

export function referenceConflicts(
  stored: StoredReferences,
  references: ChainReferences,
): string[] {
  const escrowDiffers =
    stored.escrowTxHash !== null && stored.escrowTxHash !== references.escrowTxHash;
  const resultDiffers =
    references.resultTxHash !== null &&
    stored.resultTxHash !== null &&
    stored.resultTxHash !== references.resultTxHash;
  return [...(escrowDiffers ? ["escrowTxHash"] : []), ...(resultDiffers ? ["resultTxHash"] : [])];
}

export function mergedReferences(
  stored: StoredReferences,
  references: ChainReferences,
): StoredReferences {
  return {
    escrowTxHash: references.escrowTxHash,
    resultTxHash: references.resultTxHash ?? stored.resultTxHash,
  };
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

export function createDbEvidenceStore(db: Db, campaignId: string | null = null): EvidenceStore {
  const forTask = (draft: EvidenceDraft) =>
    and(
      eq(masumiPaymentEvidence.sokosumiTaskId, draft.sokosumiTaskId),
      eq(masumiPaymentEvidence.blockchainIdentifier, draft.blockchainIdentifier),
    );

  return {
    async record(draft) {
      await db
        .insert(masumiPaymentEvidence)
        .values({ ...draft, campaignId })
        .onConflictDoNothing({ target: masumiPaymentEvidence.sokosumiTaskId });
      const [stored] = await db
        .select()
        .from(masumiPaymentEvidence)
        .where(eq(masumiPaymentEvidence.sokosumiTaskId, draft.sokosumiTaskId));
      if (stored === undefined) {
        throw new Error(`Payment evidence for Task ${draft.sokosumiTaskId} was not stored`);
      }
      const differences = [
        ...draftDifferences(stored, draft),
        ...(stored.campaignId === campaignId ? [] : ["campaignId"]),
      ];
      if (differences.length > 0) {
        throw new TerminalLifecycleError(
          `Task ${draft.sokosumiTaskId} already has payment evidence that differs in ${differences.join(", ")}`,
        );
      }
    },
    async attachTransactions(draft, references) {
      const [stored] = await db
        .select({
          escrowTxHash: masumiPaymentEvidence.escrowTxHash,
          resultTxHash: masumiPaymentEvidence.resultTxHash,
        })
        .from(masumiPaymentEvidence)
        .where(forTask(draft));
      if (stored === undefined) {
        throw new TerminalLifecycleError(
          `No payment evidence row for Task ${draft.sokosumiTaskId} to attach transactions to`,
        );
      }
      const conflicts = referenceConflicts(stored, references);
      if (conflicts.length > 0) {
        throw new TerminalLifecycleError(
          `Task ${draft.sokosumiTaskId} already has payment evidence that differs in ${conflicts.join(", ")}`,
        );
      }
      await db
        .update(masumiPaymentEvidence)
        .set(mergedReferences(stored, references))
        .where(forTask(draft));
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
