import { minuteMs } from "../../src/constants";
import { HttpStatusError } from "../../src/errors";
import type { CreatePaymentBody } from "../../src/mps/client";
import type { MpsPayment } from "../../src/mps/schemas";
import type { PaymentSchedule } from "../../src/schedule";
import type { Task, TaskEvent } from "../../src/sokosumi/schemas";
import { payment, recordedTxs, type FixtureTransaction } from "../fixtures/mps-payment";
import type { FakeClock } from "./clock";

export type FaultPoint = "start" | "attach" | "submit" | "complete";
export type Fault =
  "lost-response" | "dropped" | "conflict" | "phantom-conflict" | "insufficient-balance";

interface Quote {
  readonly blockchainIdentifier: string;
  readonly inputHash: string;
  readonly schedule: PaymentSchedule;
}

export class World {
  readonly taskId = "01a10ef7-d2cf-73d8-b084-47898de89fce";
  readonly coworkerId = "cow_datum";
  taskStatus = "READY";
  readonly events: TaskEvent[] = [];
  readonly quotes = new Map<string, Quote>();
  readonly calls = { start: 0, terms: 0, attach: 0, submit: 0, complete: 0 };
  readonly faults = new Map<FaultPoint, Fault>();
  attached: { readonly blockchainIdentifier: string; readonly at: number } | null = null;
  submitted: { readonly hash: string; readonly at: number } | null = null;
  collectionLagMs = 11 * minuteMs;
  escrowDelayMs = 2 * minuteMs;
  readonly clock: FakeClock;

  constructor(clock: FakeClock) {
    this.clock = clock;
  }

  task(): Task {
    return {
      id: this.taskId,
      name: "Gate 0 rehearsal",
      description: "Reply with one sentence.",
      status: this.taskStatus,
      assigneeId: this.coworkerId,
      ownerId: "user_owner",
      organizationId: null,
      workspace: { id: "11111111-1111-7111-8111-111111111111", organizationId: null },
      events: [...this.events],
    };
  }

  pushEvent(status: string | null, comment: string | null): TaskEvent {
    const event: TaskEvent = {
      id: `evt_${String(this.events.length + 1)}`,
      taskId: this.taskId,
      createdAt: new Date(this.clock.now() + this.events.length).toISOString(),
      status,
      comment,
      actor: { type: "coworker", id: this.coworkerId },
    };
    this.events.push(event);
    return event;
  }

  fault(point: FaultPoint): Fault | undefined {
    const fault = this.faults.get(point);
    this.faults.delete(point);
    return fault;
  }

  quote(body: CreatePaymentBody): Quote {
    this.calls.terms += 1;
    const quote = {
      blockchainIdentifier: `00e04c0860a60c61066056281180462d0b12${String(this.calls.terms).padStart(4, "0")}`,
      inputHash: body.inputHash,
      schedule: {
        payByTime: Date.parse(body.payByTime),
        submitResultTime: Date.parse(body.submitResultTime),
        unlockTime: Date.parse(body.unlockTime),
        externalDisputeUnlockTime: Date.parse(body.externalDisputeUnlockTime),
      },
    };
    this.quotes.set(quote.blockchainIdentifier, quote);
    return quote;
  }

  escrowAt(): number | null {
    return this.attached === null ? null : this.attached.at + this.escrowDelayMs;
  }

  resultAt(): number | null {
    return this.submitted === null ? null : this.submitted.at + 2 * minuteMs;
  }

  withdrawnAt(quote: Quote): number {
    return quote.schedule.unlockTime + this.collectionLagMs;
  }

  paymentFor(blockchainIdentifier: string): MpsPayment {
    const quote = this.quotes.get(blockchainIdentifier);
    if (quote === undefined) {
      throw new HttpStatusError("Masumi Payment Service", 404, "Payment not found", null);
    }
    const now = this.clock.now();
    const ours = this.attached?.blockchainIdentifier === blockchainIdentifier;
    const escrowAt = this.escrowAt();
    const resultAt = this.resultAt();
    const transactions: FixtureTransaction[] = [];
    if (ours && escrowAt !== null && now >= escrowAt) {
      transactions.push({ txHash: recordedTxs.escrow, previous: null, next: "FundsLocked" });
    }
    if (ours && resultAt !== null && now >= resultAt) {
      transactions.push({
        txHash: recordedTxs.result,
        previous: "FundsLocked",
        next: "ResultSubmitted",
      });
      if (now >= this.withdrawnAt(quote)) {
        transactions.push({
          txHash: recordedTxs.collection,
          previous: "ResultSubmitted",
          next: "Withdrawn",
        });
      }
    }
    const pendingSubmit = this.submitted !== null && transactions.length === 1;
    return payment({
      ...quote,
      onChainState: transactions.at(-1)?.next ?? null,
      transactions,
      requestedAction: pendingSubmit ? "SubmitResultRequested" : "WaitingForExternalAction",
      nextActionResultHash: pendingSubmit ? (this.submitted?.hash ?? null) : null,
      ...(transactions.length >= 2 && this.submitted !== null
        ? { resultHash: this.submitted.hash }
        : {}),
    });
  }
}
