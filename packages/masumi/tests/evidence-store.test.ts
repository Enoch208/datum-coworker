import { describe, expect, it } from "vitest";
import { mergedReferences, referenceConflicts } from "../src/evidence-store";
import { recordedTxs } from "./fixtures/mps-payment";

const nothingRecorded = { escrowTxHash: null, resultTxHash: null };
const bothRecorded = { escrowTxHash: recordedTxs.escrow, resultTxHash: recordedTxs.result };

describe("payment evidence chain references", () => {
  it("accepts the first transactions and the same ones again", () => {
    expect(referenceConflicts(nothingRecorded, bothRecorded)).toEqual([]);
    const stored = mergedReferences(nothingRecorded, bothRecorded);
    expect(stored).toEqual(bothRecorded);
    expect(referenceConflicts(stored, bothRecorded)).toEqual([]);
  });

  it("keeps a recorded result transaction when a later pass does not know it yet", () => {
    const earlier = { escrowTxHash: recordedTxs.escrow, resultTxHash: null };
    expect(referenceConflicts(bothRecorded, earlier)).toEqual([]);
    expect(mergedReferences(bothRecorded, earlier)).toEqual(bothRecorded);
  });

  it("names a different escrow or result transaction instead of overwriting it", () => {
    expect(
      referenceConflicts(bothRecorded, {
        escrowTxHash: recordedTxs.collection,
        resultTxHash: recordedTxs.result,
      }),
    ).toEqual(["escrowTxHash"]);
    expect(
      referenceConflicts(bothRecorded, {
        escrowTxHash: recordedTxs.escrow,
        resultTxHash: recordedTxs.collection,
      }),
    ).toEqual(["resultTxHash"]);
  });
});
