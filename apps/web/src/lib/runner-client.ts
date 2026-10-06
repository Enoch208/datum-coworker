import type { EvidenceView, ExpenseView, MoneyText, RunnerInboxView } from "@datum/core";
import { evidenceSchema, expenseSchema, runnerInboxSchema } from "./execution-schemas";
import { ApiRequestError, expectShape, send } from "./http";
import { postForm } from "./upload";

const inactiveStatuses: readonly number[] = [401, 403, 404, 410];

const runnerPath = (token: string): string => `/runner/${encodeURIComponent(token)}`;

const runnerTaskPath = (token: string, taskId: string): string =>
  `${runnerPath(token)}/tasks/${encodeURIComponent(taskId)}`;

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

export function acceptTask(token: string, taskId: string): Promise<void> {
  return tokenSafe(token, async () => {
    await send(`${runnerTaskPath(token, taskId)}/accept`, { method: "POST" });
  });
}

export function completeTask(token: string, taskId: string): Promise<void> {
  return tokenSafe(token, async () => {
    await send(`${runnerTaskPath(token, taskId)}/complete`, { method: "POST" });
  });
}

export function uploadEvidence(
  token: string,
  taskId: string,
  photo: File,
  onProgress: (fraction: number) => void,
): Promise<EvidenceView> {
  return tokenSafe(token, async () => {
    const form = new FormData();
    form.append("photo", photo, photo.name.length > 0 ? photo.name : "evidence.jpg");
    const body = await postForm(`${runnerTaskPath(token, taskId)}/evidence`, form, onProgress);
    return expectShape(evidenceSchema, body, "the photo check");
  });
}

export interface ExpenseSubmission {
  readonly receipt: File;
  readonly amount: MoneyText;
  readonly merchant: string;
}

export function submitExpense(
  token: string,
  taskId: string,
  submission: ExpenseSubmission,
  onProgress: (fraction: number) => void,
): Promise<ExpenseView> {
  return tokenSafe(token, async () => {
    const form = new FormData();
    const { receipt, amount, merchant } = submission;
    form.append("receipt", receipt, receipt.name.length > 0 ? receipt.name : "receipt.jpg");
    form.append("amount", amount);
    if (merchant.length > 0) form.append("merchant", merchant);
    const body = await postForm(`${runnerTaskPath(token, taskId)}/expense`, form, onProgress);
    return expectShape(expenseSchema, body, "the receipt");
  });
}
