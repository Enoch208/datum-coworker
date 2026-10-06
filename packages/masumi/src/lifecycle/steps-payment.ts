import { TerminalLifecycleError, isHttpStatus } from "../errors";
import { confirmedTransition } from "../mps/states";
import { attachWindowMs, submitWindowMs } from "../schedule";
import { masumiPaymentPayload } from "../terms";
import type { LifecycleDeps } from "./deps";
import { beginOutbound, isPending, persist, rejectedWrite } from "./persist";
import type { LifecycleState, StateAt } from "./state";

async function coreHoldsPayment(
  state: StateAt<"terms_requested">,
  deps: LifecycleDeps,
): Promise<boolean> {
  const receipt = await deps.core.receipt(state.taskId);
  if (receipt.blockchainIdentifier === null) {
    return false;
  }
  if (
    receipt.blockchainIdentifier.toLowerCase() !== state.terms.blockchainIdentifier.toLowerCase()
  ) {
    throw new TerminalLifecycleError(`Task ${state.taskId} already carries a different payment`);
  }
  return true;
}

function attached(
  state: StateAt<"terms_requested">,
  deps: LifecycleDeps,
  paymentEventId: string | null,
  detail: string,
): Promise<StateAt<"payment_attached">> {
  deps.log(`masumiPayment attached to Task ${state.taskId} (${detail})`);
  const next: StateAt<"payment_attached"> = {
    ...state,
    step: "payment_attached",
    outbound: null,
    paymentEventId,
  };
  return persist(deps, next, "step:payment_attached", detail);
}

export async function attachPayment(
  state: StateAt<"terms_requested">,
  deps: LifecycleDeps,
): Promise<LifecycleState> {
  if (isPending(state, "attach_payment")) {
    if (await coreHoldsPayment(state, deps)) {
      return attached(state, deps, null, "reconciled from the Core receipt");
    }
    deps.log("Core holds no payment for this Task, so the earlier attach never landed");
  }
  if (Number(state.terms.payByTime) - deps.clock.now() < attachWindowMs) {
    const { terms, ...rest } = state;
    const fresh: StateAt<"started"> = { ...rest, step: "started", outbound: null };
    deps.log(`Terms ${terms.paymentId} are too close to payBy and were never attached; renewing`);
    return persist(deps, fresh, "terms_dropped_unattached", terms.blockchainIdentifier);
  }
  const pending = await beginOutbound(deps, state, "attach_payment", state.terms.paymentId);
  try {
    const event = await deps.core.postEvent(state.taskId, {
      comment: "Datum attached signed Masumi payment terms.",
      masumiPayment: masumiPaymentPayload(
        state.terms,
        state.nonce,
        deps.config.supportedPaymentSourceIndex,
      ),
    });
    return await attached(pending, deps, event.id, `event ${event.id}`);
  } catch (error) {
    if (isHttpStatus(error, 409)) {
      if (await coreHoldsPayment(pending, deps)) {
        return attached(
          pending,
          deps,
          null,
          "Core answered 409 and its receipt holds this payment",
        );
      }
      throw new TerminalLifecycleError(
        "Core answered 409 but holds no payment for this Task; inspect its events before rerunning",
      );
    }
    throw rejectedWrite(error, "Attaching masumiPayment");
  }
}

export async function awaitEscrow(
  state: StateAt<"payment_attached">,
  deps: LifecycleDeps,
): Promise<LifecycleState> {
  const payment = await deps.mps.resolvePayment(state.terms.blockchainIdentifier);
  const lock = confirmedTransition(payment, "FundsLocked");
  if (payment.onChainState === "FundsLocked" && lock?.txHash != null) {
    deps.log(`Escrow confirmed FundsLocked in tx ${lock.txHash}`);
    const next: StateAt<"funds_locked"> = {
      ...state,
      step: "funds_locked",
      escrowTxHash: lock.txHash,
    };
    return persist(deps, next, "step:funds_locked", lock.txHash);
  }
  if (payment.onChainState !== null && payment.onChainState !== "FundsLocked") {
    throw new TerminalLifecycleError(`Payment moved to ${payment.onChainState} before escrow`);
  }
  if (Number(state.terms.submitResultTime) - deps.clock.now() < submitWindowMs) {
    throw new TerminalLifecycleError("Escrow did not lock in time to submit the result hash");
  }
  deps.log(`Waiting for confirmed escrow (onChainState ${payment.onChainState ?? "none"})`);
  return state;
}
