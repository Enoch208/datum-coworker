import { TerminalLifecycleError } from "../errors";
import type { EvidenceDraft } from "../evidence-store";
import { sokosumiResultHash } from "../hash";
import type { MpsPayment } from "../mps/schemas";
import { confirmedTransition } from "../mps/states";
import { submitWindowMs } from "../schedule";
import type { LifecycleDeps } from "./deps";
import { beginOutbound, isPending, persist, rejectedWrite } from "./persist";
import type { LifecycleState, StateAt } from "./state";

type WithResult = StateAt<
  "result_saved" | "result_submitted" | "result_confirmed" | "task_completed" | "collected"
>;

export function evidenceDraft(state: WithResult, deps: LifecycleDeps): EvidenceDraft {
  return {
    sokosumiTaskId: state.taskId,
    paymentId: state.terms.paymentId,
    blockchainIdentifier: state.terms.blockchainIdentifier,
    resultHash: state.result.hash,
    sellerAddress: deps.config.sellerAddress,
    tokenUnit: deps.config.unit,
  };
}

function assertSubmitWindow(state: StateAt<"funds_locked" | "result_saved">, deps: LifecycleDeps) {
  if (Number(state.terms.submitResultTime) - deps.clock.now() < submitWindowMs) {
    throw new TerminalLifecycleError("Too close to submitResultTime for MPS to submit the result");
  }
}

async function durableResultText(
  state: StateAt<"funds_locked">,
  deps: LifecycleDeps,
): Promise<string | null> {
  const saved = await deps.journal.loadResult(state.taskId);
  if (saved !== null) {
    if (saved.length === 0) {
      throw new TerminalLifecycleError(`The saved result file for Task ${state.taskId} is empty`);
    }
    deps.log("A result file was saved before the restart; adopting those exact bytes");
    return saved;
  }
  const text = await deps.produceResult({
    taskId: state.taskId,
    name: state.task.name,
    description: state.task.description,
    inputHash: state.inputHash,
  });
  if (text === null) {
    return null;
  }
  if (text.length === 0) {
    throw new TerminalLifecycleError("The work produced an empty result");
  }
  await deps.journal.saveResult(state.taskId, text);
  return text;
}

export async function saveResult(
  state: StateAt<"funds_locked">,
  deps: LifecycleDeps,
): Promise<LifecycleState> {
  assertSubmitWindow(state, deps);
  const text = await durableResultText(state, deps);
  if (text === null) {
    deps.log(`The work for Task ${state.taskId} has not finished; no result to save yet`);
    return state;
  }
  const hash = sokosumiResultHash(text, state.nonce);
  const next: StateAt<"result_saved"> = { ...state, step: "result_saved", result: { text, hash } };
  const saved = await persist(deps, next, "step:result_saved", hash);
  await deps.evidence.record(evidenceDraft(saved, deps));
  deps.log(`Result saved (${String(Buffer.byteLength(text, "utf8"))} bytes), hash ${hash}`);
  return saved;
}

function acceptedResult(payment: MpsPayment, hash: string): boolean {
  const queued =
    payment.NextAction.resultHash === hash &&
    (payment.NextAction.requestedAction === "SubmitResultRequested" ||
      payment.NextAction.requestedAction === "SubmitResultInitiated");
  return queued || (payment.onChainState === "ResultSubmitted" && payment.resultHash === hash);
}

function submitted(state: StateAt<"result_saved">, deps: LifecycleDeps, detail: string) {
  deps.log(`Result hash accepted by MPS (${detail})`);
  const next: StateAt<"result_submitted"> = { ...state, step: "result_submitted", outbound: null };
  return persist(deps, next, "step:result_submitted", detail);
}

export async function submitResult(
  state: StateAt<"result_saved">,
  deps: LifecycleDeps,
): Promise<LifecycleState> {
  await deps.evidence.record(evidenceDraft(state, deps));
  const identifier = state.terms.blockchainIdentifier;
  if (isPending(state, "submit_result")) {
    const payment = await deps.mps.resolvePayment(identifier);
    if (acceptedResult(payment, state.result.hash)) {
      return submitted(state, deps, "reconciled from MPS");
    }
    const resubmittable =
      payment.onChainState === "FundsLocked" &&
      payment.NextAction.requestedAction === "WaitingForExternalAction";
    if (!resubmittable) {
      throw new TerminalLifecycleError(
        `Result submission outcome unclear: ${payment.onChainState ?? "none"} / ${payment.NextAction.requestedAction}`,
      );
    }
  }
  assertSubmitWindow(state, deps);
  const pending = await beginOutbound(deps, state, "submit_result", state.result.hash);
  const payment = await deps.mps
    .submitResult(identifier, state.result.hash)
    .catch((error: unknown) => {
      throw rejectedWrite(error, "Submitting the result hash");
    });
  if (!acceptedResult(payment, state.result.hash)) {
    throw new TerminalLifecycleError("MPS answered submit-result without recording our hash");
  }
  return submitted(pending, deps, "submit-result accepted");
}

export async function awaitResultOnChain(
  state: StateAt<"result_submitted">,
  deps: LifecycleDeps,
): Promise<LifecycleState> {
  const payment = await deps.mps.resolvePayment(state.terms.blockchainIdentifier);
  const confirmed = confirmedTransition(payment, "ResultSubmitted");
  const onChainHashMatches = payment.resultHash === state.result.hash;
  if (
    payment.onChainState === "ResultSubmitted" &&
    onChainHashMatches &&
    confirmed?.txHash != null
  ) {
    deps.log(`ResultSubmitted confirmed in tx ${confirmed.txHash}`);
    const next: StateAt<"result_confirmed"> = {
      ...state,
      step: "result_confirmed",
      resultTxHash: confirmed.txHash,
    };
    return persist(deps, next, "step:result_confirmed", confirmed.txHash);
  }
  if (payment.onChainState === "ResultSubmitted" && !onChainHashMatches) {
    throw new TerminalLifecycleError("The on-chain result hash differs from the saved result");
  }
  if (payment.NextAction.requestedAction === "WaitingForManualAction") {
    throw new TerminalLifecycleError(
      `MPS needs manual action: ${payment.NextAction.errorNote ?? "no note"}`,
    );
  }
  if (payment.onChainState !== "FundsLocked" && payment.onChainState !== "ResultSubmitted") {
    throw new TerminalLifecycleError(`Payment moved to ${payment.onChainState ?? "none"}`);
  }
  if (deps.clock.now() >= Number(state.terms.submitResultTime)) {
    throw new TerminalLifecycleError("submitResultTime passed without a confirmed ResultSubmitted");
  }
  deps.log(`Waiting for ResultSubmitted (next action ${payment.NextAction.requestedAction})`);
  return state;
}
