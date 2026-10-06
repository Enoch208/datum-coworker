import { TerminalLifecycleError } from "../errors";
import { newPurchaserNonce } from "../hash";
import type { LifecycleDeps } from "./deps";
import { instant } from "./persist";
import { initialState, type LifecycleState, type StateAt } from "./state";
import { attachPayment, awaitEscrow } from "./steps-payment";
import { awaitResultOnChain, saveResult, submitResult } from "./steps-result";
import { awaitCollection, completeTask, verifySettlement } from "./steps-settle";
import { requestTerms, startTask } from "./steps-start";

export function advance(state: LifecycleState, deps: LifecycleDeps): Promise<LifecycleState> {
  switch (state.step) {
    case "new":
      return startTask(state, deps);
    case "started":
      return requestTerms(state, deps);
    case "terms_requested":
      return attachPayment(state, deps);
    case "payment_attached":
      return awaitEscrow(state, deps);
    case "funds_locked":
      return saveResult(state, deps);
    case "result_saved":
      return submitResult(state, deps);
    case "result_submitted":
      return awaitResultOnChain(state, deps);
    case "result_confirmed":
      return completeTask(state, deps);
    case "task_completed":
      return awaitCollection(state, deps);
    case "collected":
      return verifySettlement(state, deps);
    case "verified":
      return Promise.resolve(state);
  }
}

export interface RunOptions {
  readonly pollMs: number;
  readonly maxConsecutiveFailures: number;
}

export async function openLifecycle(
  taskId: string,
  deps: Pick<LifecycleDeps, "journal" | "clock" | "log">,
): Promise<LifecycleState> {
  const saved = await deps.journal.load(taskId);
  if (saved !== null) {
    deps.log(`Resuming Task ${taskId} at step ${saved.step}`);
    return saved;
  }
  const fresh = initialState(taskId, newPurchaserNonce(), instant(deps));
  await deps.journal.save(fresh);
  deps.log(`Opened a new journal for Task ${taskId}`);
  return fresh;
}

export async function runLifecycle(
  taskId: string,
  deps: LifecycleDeps,
  options: RunOptions,
): Promise<StateAt<"verified">> {
  let state = await openLifecycle(taskId, deps);
  let failures = 0;
  for (;;) {
    if (state.step === "verified") {
      return state;
    }
    let next: LifecycleState;
    try {
      next = await advance(state, deps);
      failures = 0;
    } catch (error) {
      if (error instanceof TerminalLifecycleError) {
        throw error;
      }
      failures += 1;
      const reason = error instanceof Error ? error.message : String(error);
      deps.log(
        `Step ${state.step} failed (${String(failures)}/${String(options.maxConsecutiveFailures)}): ${reason}`,
      );
      if (failures >= options.maxConsecutiveFailures) {
        throw new TerminalLifecycleError(`Step ${state.step} kept failing: ${reason}`);
      }
      await deps.clock.sleep(options.pollMs);
      state = (await deps.journal.load(taskId)) ?? state;
      continue;
    }
    if (next.step === state.step) {
      await deps.clock.sleep(options.pollMs);
    }
    state = next;
  }
}
