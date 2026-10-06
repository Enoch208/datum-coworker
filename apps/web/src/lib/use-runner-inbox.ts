import type { RunnerInboxView } from "@datum/core";
import { useCallback } from "react";
import { getRunnerInbox } from "./runner-client";
import { usePoll, useResource, type Resource } from "./use-resource";

export const runnerPollMs = 5000;

export function useRunnerInbox(token: string): Resource<RunnerInboxView> {
  const load = useCallback((signal: AbortSignal) => getRunnerInbox(token, signal), [token]);
  const inbox = useResource(`runner:${token}`, load);
  usePoll(true, runnerPollMs, !inbox.pending, inbox.reload);
  return inbox;
}
