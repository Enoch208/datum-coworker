import { HttpStatusError, TerminalLifecycleError } from "../errors";
import type { LifecycleDeps } from "./deps";
import type { LifecycleState, OutboundAction } from "./state";

export function instant(deps: Pick<LifecycleDeps, "clock">): string {
  return new Date(deps.clock.now()).toISOString();
}

export async function persist<State extends LifecycleState>(
  deps: Pick<LifecycleDeps, "clock" | "journal">,
  state: State,
  event: string,
  detail: string | null = null,
): Promise<State> {
  const next: State = {
    ...state,
    history: [...state.history, { at: instant(deps), event, detail }],
  };
  await deps.journal.save(next);
  return next;
}

export function beginOutbound<State extends LifecycleState>(
  deps: Pick<LifecycleDeps, "clock" | "journal">,
  state: State,
  action: OutboundAction,
  detail: string | null,
): Promise<State> {
  return persist(
    deps,
    { ...state, outbound: { action, since: instant(deps) } },
    `intent:${action}`,
    detail,
  );
}

export function isPending(state: LifecycleState, action: OutboundAction): boolean {
  return state.outbound?.action === action;
}

const grantGuidance: Readonly<Record<string, string>> = {
  grant_required:
    "Approve the Vendor access request in the Task owner's Personal Workspace notifications, then rerun for the same Task.",
  grant_denied: "A Workspace owner must resolve the denied Vendor access before rerunning.",
  grant_revoked: "A Workspace owner must resolve the revoked Vendor access before rerunning.",
  insufficient_balance:
    "Core paused the Task to OUT_OF_CREDITS. Add Personal Workspace test credits, then rerun.",
};

const retryableStatuses = new Set([404, 408, 409, 429]);

export function rejectedWrite(error: unknown, action: string): unknown {
  if (
    error instanceof HttpStatusError &&
    error.status >= 400 &&
    error.status < 500 &&
    !retryableStatuses.has(error.status)
  ) {
    const guidance = error.kind === null ? undefined : grantGuidance[error.kind];
    return new TerminalLifecycleError(
      `${action} was rejected. ${error.message}${guidance === undefined ? "" : ` ${guidance}`}`,
    );
  }
  return error;
}
