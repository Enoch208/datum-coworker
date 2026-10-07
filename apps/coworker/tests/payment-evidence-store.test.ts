import { masumiPaymentEvidence } from "@datum/db";
import {
  createDbEvidenceStore,
  TerminalLifecycleError,
  tusdmUnit,
  type EvidenceDraft,
} from "@datum/masumi";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { recordedSeller, recordedTxs } from "../../../packages/masumi/tests/fixtures/mps-payment";
import { db, resetDatabaseBetweenTests } from "./support/harness";

resetDatabaseBetweenTests();

const draft: EvidenceDraft = {
  sokosumiTaskId: "task_store_proof",
  paymentId: "pay_store_proof",
  blockchainIdentifier: "00e04c0860a60c61066056281180462d0b120001",
  resultHash: "a".repeat(64),
  sellerAddress: recordedSeller.sellerAddress,
  tokenUnit: tusdmUnit,
};

const storedRow = async () => {
  const [row] = await db
    .select()
    .from(masumiPaymentEvidence)
    .where(eq(masumiPaymentEvidence.sokosumiTaskId, draft.sokosumiTaskId));
  if (row === undefined) throw new Error("the evidence row was not stored");
  return row;
};

describe("payment evidence keeps the chain of transactions behind a Task", () => {
  it("adds the escrow, then the result, then the collection without losing an earlier one", async () => {
    const store = createDbEvidenceStore(db);
    await store.record(draft);
    expect(await storedRow()).toMatchObject({ escrowTxHash: null, resultTxHash: null });

    await store.attachTransactions(draft, { escrowTxHash: recordedTxs.escrow, resultTxHash: null });
    expect(await storedRow()).toMatchObject({
      escrowTxHash: recordedTxs.escrow,
      resultTxHash: null,
    });

    const references = { escrowTxHash: recordedTxs.escrow, resultTxHash: recordedTxs.result };
    await store.attachTransactions(draft, references);
    await store.attachTransactions(draft, { escrowTxHash: recordedTxs.escrow, resultTxHash: null });
    expect(await storedRow()).toMatchObject(references);

    await store.confirmCollection(draft, {
      collectionTxHash: recordedTxs.collection,
      netReceivedAtomic: "1000000",
      verifiedAt: new Date("2026-10-07T12:00:00.000Z"),
    });
    expect(await storedRow()).toMatchObject({
      ...references,
      collectionTxHash: recordedTxs.collection,
      collectionConfirmed: true,
    });
  });

  it("refuses to replace a recorded transaction with a different one", async () => {
    const store = createDbEvidenceStore(db);
    await store.record(draft);
    await store.attachTransactions(draft, {
      escrowTxHash: recordedTxs.escrow,
      resultTxHash: recordedTxs.result,
    });

    await expect(
      store.attachTransactions(draft, {
        escrowTxHash: recordedTxs.collection,
        resultTxHash: recordedTxs.result,
      }),
    ).rejects.toThrow(TerminalLifecycleError);
    await expect(
      store.attachTransactions(draft, {
        escrowTxHash: recordedTxs.escrow,
        resultTxHash: recordedTxs.collection,
      }),
    ).rejects.toThrow(/differs in resultTxHash/);
    expect(await storedRow()).toMatchObject({
      escrowTxHash: recordedTxs.escrow,
      resultTxHash: recordedTxs.result,
    });
  });

  it("refuses to attach to a payment it has no evidence row for", async () => {
    const store = createDbEvidenceStore(db);
    await expect(
      store.attachTransactions(draft, { escrowTxHash: recordedTxs.escrow, resultTxHash: null }),
    ).rejects.toThrow(/No payment evidence row/);
  });

  it("rejects a value that is not a transaction hash at the database", async () => {
    const store = createDbEvidenceStore(db);
    await store.record(draft);
    await expect(
      store.attachTransactions(draft, { escrowTxHash: "not-a-transaction", resultTxHash: null }),
    ).rejects.toThrow();
    expect(await storedRow()).toMatchObject({ escrowTxHash: null });
  });
});
