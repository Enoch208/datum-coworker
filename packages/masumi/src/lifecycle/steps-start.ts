import { TerminalLifecycleError } from "../errors";
import { taskInputHash } from "../hash";
import { assertMpsTimingRules, buildSchedule, scheduleRequestTimes } from "../schedule";
import { validateSignedTerms } from "../terms";
import type { LifecycleDeps } from "./deps";
import { beginOutbound, isPending, persist, rejectedWrite } from "./persist";
import type { LifecycleState, StateAt } from "./state";

export async function startTask(
  state: StateAt<"new">,
  deps: LifecycleDeps,
): Promise<LifecycleState> {
  const me = await deps.core.me();
  if (me.archivedAt !== null || !me.capabilities.includes("tasks")) {
    throw new TerminalLifecycleError("The coworker key does not belong to an active Task Coworker");
  }
  const task = await deps.core.task(state.taskId);
  if (task.assigneeId !== me.id) {
    throw new TerminalLifecycleError(`Task ${task.id} is not assigned to Coworker ${me.id}`);
  }
  const started = async (from: StateAt<"new">, detail: string) => {
    const description = task.description;
    const next: StateAt<"started"> = {
      ...from,
      step: "started",
      outbound: null,
      task: { name: task.name, description },
      inputHash: taskInputHash({ taskId: task.id, name: task.name, description }, from.nonce),
    };
    deps.log(`Task ${task.id} is RUNNING (${detail})`);
    return persist(deps, next, "step:started", detail);
  };
  if (task.status === "RUNNING" && isPending(state, "start_task")) {
    return started(state, "reconciled: Core already shows RUNNING");
  }
  if (task.status !== "READY") {
    throw new TerminalLifecycleError(`Task ${task.id} is ${task.status}; it must be READY`);
  }
  if (task.organizationId === null) {
    const personal = await deps.core.confirmPersonalWorkspace(task.workspace.id, task.ownerId);
    if (!personal) {
      throw new TerminalLifecycleError("Core did not confirm the Task's personal Workspace");
    }
  }
  const pending = await beginOutbound(deps, state, "start_task", null);
  const event = await deps.core
    .postEvent(task.id, { status: "RUNNING" })
    .catch((error: unknown) => {
      throw rejectedWrite(error, "Starting the Task");
    });
  if (event.status !== "RUNNING") {
    throw new TerminalLifecycleError("Core did not confirm the RUNNING event");
  }
  return started(pending, `event ${event.id}`);
}

export async function requestTerms(
  state: StateAt<"started">,
  deps: LifecycleDeps,
): Promise<LifecycleState> {
  if (isPending(state, "request_terms")) {
    deps.log("Earlier terms request has no recorded answer; unattached terms are never funded");
  }
  const now = deps.clock.now();
  const schedule = buildSchedule(now);
  assertMpsTimingRules(schedule, now);
  const times = scheduleRequestTimes(schedule);
  const { config } = deps;
  const pending = await beginOutbound(deps, state, "request_terms", JSON.stringify(times));
  const payment = await deps.mps
    .createPayment({
      network: "Preprod",
      agentIdentifier: config.agentIdentifier,
      paymentSourceType: "Web3CardanoV2",
      supportedPaymentSourceIndex: config.supportedPaymentSourceIndex,
      inputHash: state.inputHash,
      identifierFromPurchaser: state.nonce,
      RequestedFunds: [{ amount: config.amountAtomic, unit: config.unit }],
      ...times,
      metadata: JSON.stringify({ taskId: state.taskId }),
    })
    .catch((error: unknown) => {
      throw rejectedWrite(error, "Requesting signed terms");
    });
  const terms = validateSignedTerms(payment, {
    agentIdentifier: config.agentIdentifier,
    inputHash: state.inputHash,
    sellerAddress: config.sellerAddress,
    amountAtomic: config.amountAtomic,
    unit: config.unit,
    schedule,
  });
  deps.log(
    `Signed terms ${terms.paymentId} validated: payBy ${times.payByTime}, submitResult ${times.submitResultTime}, unlock ${times.unlockTime}`,
  );
  const next: StateAt<"terms_requested"> = {
    ...pending,
    step: "terms_requested",
    outbound: null,
    terms,
  };
  return persist(deps, next, "step:terms_requested", terms.blockchainIdentifier);
}
