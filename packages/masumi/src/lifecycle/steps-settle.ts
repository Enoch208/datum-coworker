import { minuteMs } from "../constants";
import { TerminalLifecycleError } from "../errors";
import { lostPaymentStates, sellerSettlement } from "../mps/states";
import { collectionEligibleAfterUnlockMs, collectionOverdueAfterUnlockMs } from "../schedule";
import type { Task } from "../sokosumi/schemas";
import { verifyCollection } from "../verify";
import type { LifecycleDeps } from "./deps";
import { beginOutbound, isPending, persist, rejectedWrite } from "./persist";
import type { LifecycleState, StateAt } from "./state";
import { evidenceDraft } from "./steps-result";

function completed(
  state: StateAt<"result_confirmed">,
  deps: LifecycleDeps,
  completionEventId: string,
  storedComment: string | null | undefined,
) {
  const matches = storedComment === state.result.text;
  deps.log(
    `Task ${state.taskId} COMPLETED in event ${completionEventId}; stored comment ${matches ? "equals" : "DIFFERS FROM"} the saved result`,
  );
  const next: StateAt<"task_completed"> = {
    ...state,
    step: "task_completed",
    outbound: null,
    completionEventId,
  };
  return persist(deps, next, "step:task_completed", `comment matches result: ${String(matches)}`);
}

function latestCompletion(task: Task) {
  return task.events
    .filter((event) => event.status === "COMPLETED")
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0];
}

export async function completeTask(
  state: StateAt<"result_confirmed">,
  deps: LifecycleDeps,
): Promise<LifecycleState> {
  if (isPending(state, "complete_task")) {
    const task = await deps.core.task(state.taskId);
    const completion = latestCompletion(task);
    if (task.status === "COMPLETED" && completion !== undefined) {
      return completed(state, deps, completion.id, completion.comment);
    }
    if (task.status !== "RUNNING") {
      throw new TerminalLifecycleError(`Task is ${task.status} while completion was in flight`);
    }
  }
  const pending = await beginOutbound(deps, state, "complete_task", state.result.hash);
  const event = await deps.core
    .postEvent(state.taskId, { status: "COMPLETED", comment: state.result.text })
    .catch((error: unknown) => {
      throw rejectedWrite(error, "Completing the Task");
    });
  if (event.status !== "COMPLETED") {
    throw new TerminalLifecycleError("Core did not confirm the COMPLETED event");
  }
  return completed(pending, deps, event.id, event.comment);
}

export async function awaitCollection(
  state: StateAt<"task_completed">,
  deps: LifecycleDeps,
): Promise<LifecycleState> {
  const payment = await deps.mps.resolvePayment(state.terms.blockchainIdentifier);
  const settlement = sellerSettlement(payment);
  if (settlement?.txHash != null) {
    deps.log(`MPS confirmed ${payment.onChainState ?? ""} in tx ${settlement.txHash}`);
    const next: StateAt<"collected"> = {
      ...state,
      step: "collected",
      collectionTxHash: settlement.txHash,
    };
    return persist(deps, next, "step:collected", settlement.txHash);
  }
  if (payment.onChainState !== null && lostPaymentStates.includes(payment.onChainState)) {
    throw new TerminalLifecycleError(`Payment moved to ${payment.onChainState}; no seller payout`);
  }
  const unlock = Number(state.terms.unlockTime);
  const now = deps.clock.now();
  if (now > unlock + collectionOverdueAfterUnlockMs) {
    throw new TerminalLifecycleError(
      "Collection is overdue; check that MPS is running with AUTO_WITHDRAW_PAYMENTS=true",
    );
  }
  const eligibleInMinutes = Math.max(
    0,
    Math.ceil((unlock + collectionEligibleAfterUnlockMs - now) / minuteMs),
  );
  deps.log(
    `Waiting for seller collection (onChainState ${payment.onChainState ?? "none"}, eligible in ~${String(eligibleInMinutes)} min)`,
  );
  return state;
}

export async function verifySettlement(
  state: StateAt<"collected">,
  deps: LifecycleDeps,
): Promise<LifecycleState> {
  const receipt = await deps.core.receipt(state.taskId);
  if (!receipt.settled) {
    deps.log(`Core receipt not settled yet (onChainState ${receipt.onChainState ?? "none"})`);
    return state;
  }
  const payment = await deps.mps.resolvePayment(state.terms.blockchainIdentifier);
  const proof = await verifyCollection(
    {
      blockchainIdentifier: state.terms.blockchainIdentifier,
      collectionTxHash: state.collectionTxHash,
      sellerAddress: deps.config.sellerAddress,
      unit: deps.config.unit,
      expectedNetAtomic: deps.config.amountAtomic,
    },
    receipt,
    payment,
    deps.chain,
    new Date(deps.clock.now()),
  );
  await deps.evidence.confirmCollection(evidenceDraft(state, deps), {
    collectionTxHash: proof.txHash,
    netReceivedAtomic: proof.netReceivedAtomic,
    verifiedAt: new Date(proof.verifiedAt),
  });
  deps.log(
    `Verified: tx ${proof.txHash} paid the seller ${proof.netReceivedAtomic} atomic tUSDM (${String(proof.confirmations)} confirmations)`,
  );
  const next: StateAt<"verified"> = { ...state, step: "verified", proof };
  return persist(deps, next, "step:verified", proof.txHash);
}
