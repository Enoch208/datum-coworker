import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MasumiPaymentEvidence } from "@datum/core";
import { gate0AmountAtomic, tusdmUnit } from "../../src/constants";
import { HttpStatusError } from "../../src/errors";
import { draftDifferences, type EvidenceStore } from "../../src/evidence-store";
import { gate0Result } from "../../src/gate0/result";
import type { LifecycleDeps } from "../../src/lifecycle/deps";
import { createFileJournal } from "../../src/lifecycle/journal";
import type { PaymentNode } from "../../src/mps/client";
import type { CoreClient } from "../../src/sokosumi/client";
import type { ChainReader } from "../../src/chain/blockfrost";
import { recordedChain, recordedResultHash, resultUtxosNaming } from "../fixtures/chain";
import { recordedSeller, recordedTxs } from "../fixtures/mps-payment";
import type { World } from "./world";

const lostResponse = () => new TypeError("fetch failed");
const later = <T>(work: () => T): Promise<T> => Promise.resolve().then(work);

export function fakeCore(world: World): LifecycleDeps["core"] {
  const core: Pick<
    CoreClient,
    "me" | "task" | "confirmPersonalWorkspace" | "postEvent" | "receipt"
  > = {
    me: () =>
      Promise.resolve({ id: world.coworkerId, archivedAt: null, capabilities: ["chat", "tasks"] }),
    task: () => Promise.resolve(world.task()),
    confirmPersonalWorkspace: () => Promise.resolve(true),
    postEvent: (_taskId, body) =>
      later(() => {
        if ("masumiPayment" in body) {
          world.calls.attach += 1;
          const fault = world.fault("attach");
          if (fault === "insufficient-balance") {
            world.taskStatus = "OUT_OF_CREDITS";
            throw new HttpStatusError("Sokosumi Core", 422, "Insufficient", "insufficient_balance");
          }
          if (fault === "dropped") throw lostResponse();
          const conflict = new HttpStatusError("Sokosumi Core", 409, "Conflict", null);
          if (world.attached !== null || fault === "phantom-conflict") throw conflict;
          world.attached = {
            blockchainIdentifier: body.masumiPayment.blockchainIdentifier,
            at: world.clock.now(),
          };
          if (fault === "conflict") throw conflict;
          const event = world.pushEvent(null, body.comment);
          if (fault === "lost-response") throw lostResponse();
          return event;
        }
        const point = body.status === "RUNNING" ? "start" : "complete";
        world.calls[point] += 1;
        world.taskStatus = body.status;
        const event = world.pushEvent(
          body.status,
          "comment" in body ? world.storeComment(body.comment) : null,
        );
        if (world.fault(point) === "lost-response") throw lostResponse();
        return event;
      }),
    receipt: () => {
      const quote =
        world.attached === null ? undefined : world.quotes.get(world.attached.blockchainIdentifier);
      const settled = quote !== undefined && world.clock.now() >= world.withdrawnAt(quote) + 60_000;
      return Promise.resolve({
        blockchainIdentifier: world.attached?.blockchainIdentifier.toLowerCase() ?? null,
        claimStatus: world.attached === null ? null : "PURCHASED",
        onChainState: settled ? "Withdrawn" : null,
        settled,
        txHash: settled ? recordedTxs.collection : null,
        withdrawnForSeller: [],
      });
    },
  };
  return core;
}

export function fakeMps(world: World): PaymentNode {
  return {
    createPayment: (body) => later(() => world.paymentFor(world.quote(body).blockchainIdentifier)),
    resolvePayment: (blockchainIdentifier) => later(() => world.paymentFor(blockchainIdentifier)),
    submitResult: (blockchainIdentifier, hash) =>
      later(() => {
        world.calls.submit += 1;
        if (
          world.paymentFor(blockchainIdentifier).onChainState !== "FundsLocked" ||
          world.submitted
        ) {
          throw new HttpStatusError("Masumi Payment Service", 404, "invalid state", null);
        }
        world.submitted = { hash, at: world.clock.now() };
        const accepted = world.paymentFor(blockchainIdentifier);
        if (world.fault("submit") === "lost-response") throw lostResponse();
        return accepted;
      }),
  };
}

export class MemoryEvidence implements EvidenceStore {
  readonly rows = new Map<string, MasumiPaymentEvidence>();

  record: EvidenceStore["record"] = (draft) => {
    const stored = this.rows.get(draft.sokosumiTaskId);
    if (stored === undefined) {
      this.rows.set(draft.sokosumiTaskId, {
        ...draft,
        collectionTxHash: null,
        netReceivedAtomic: null,
        collectionConfirmed: false,
        verifiedAt: null,
      });
    } else if (draftDifferences(stored, draft).length > 0) {
      return Promise.reject(new Error("evidence differs"));
    }
    return Promise.resolve();
  };

  confirmCollection: EvidenceStore["confirmCollection"] = (draft, proof) => {
    const stored = this.rows.get(draft.sokosumiTaskId);
    if (stored?.blockchainIdentifier !== draft.blockchainIdentifier) {
      return Promise.reject(new Error("no evidence row"));
    }
    this.rows.set(draft.sokosumiTaskId, {
      ...stored,
      collectionTxHash: proof.collectionTxHash,
      netReceivedAtomic: proof.netReceivedAtomic,
      collectionConfirmed: true,
      verifiedAt: proof.verifiedAt.toISOString(),
    });
    return Promise.resolve();
  };
}

export function worldChain(world: World, collectionUtxos?: unknown): ChainReader {
  return recordedChain(collectionUtxos, () =>
    resultUtxosNaming(world.submitted?.hash ?? recordedResultHash),
  );
}

export const journalDirectory = () => mkdtemp(join(tmpdir(), "datum-masumi-"));

export function lifecycleDeps(
  world: World,
  directory: string,
  evidence: EvidenceStore,
  lines: string[] = [],
): LifecycleDeps {
  return {
    core: fakeCore(world),
    mps: fakeMps(world),
    chain: worldChain(world),
    journal: createFileJournal(directory),
    evidence,
    clock: world.clock,
    config: {
      agentIdentifier: recordedSeller.agentIdentifier,
      supportedPaymentSourceIndex: 0,
      sellerAddress: recordedSeller.sellerAddress,
      amountAtomic: gate0AmountAtomic,
      unit: tusdmUnit,
    },
    produceResult: gate0Result,
    log: (line) => lines.push(line),
  };
}
