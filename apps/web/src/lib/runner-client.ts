import type { RunnerInboxView } from "@datum/core";
import { runnerInboxSchema } from "./execution-schemas";
import { ApiRequestError, expectShape, send } from "./http";

const inactiveStatuses: readonly number[] = [401, 403, 404, 410];

const runnerPath = (token: string): string => `/runner/${encodeURIComponent(token)}`;

function withoutToken(token: string, cause: unknown): Error {
  if (!(cause instanceof Error)) return new Error(String(cause));
  if (!(cause instanceof ApiRequestError) || token.length === 0) return cause;
  const message = cause.message.replaceAll(encodeURIComponent(token), "…").replaceAll(token, "…");
  return new ApiRequestError(cause.status, cause.code, message);
}

export async function tokenSafe<T>(token: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (cause) {
    throw withoutToken(token, cause);
  }
}

export const isInactiveLink = (error: Error | null): boolean =>
  error instanceof ApiRequestError && inactiveStatuses.includes(error.status);

export function getRunnerInbox(token: string, signal: AbortSignal): Promise<RunnerInboxView> {
  return tokenSafe(token, async () => {
    const body = await send(runnerPath(token), { method: "GET", signal });
    return expectShape(runnerInboxSchema, body, "your tasks");
  });
}
