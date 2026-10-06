import type { EnrolledRunnerView } from "@datum/core";
import { expect } from "vitest";
import { app, appBaseUrl, operatorKey } from "../support";

export interface OperatorReply<Body> {
  readonly status: number;
  readonly body: Body;
}

export async function asOperator<Body>(
  method: string,
  path: string,
  payload?: unknown,
  key: string | null = operatorKey,
  target = app,
): Promise<OperatorReply<Body>> {
  const response = await target.request(path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(key === null ? {} : { "x-operator-key": key }),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const body: unknown = await response.json();
  return { status: response.status, body: body as Body };
}

export const inFuture = (milliseconds = 86_400_000): string =>
  new Date(Date.now() + milliseconds).toISOString();

export interface EnrolledRunner {
  readonly view: EnrolledRunnerView;
  readonly token: string;
}

export const runnerLinkLifetimeMs = 2 * 86_400_000;

export async function enrollTestRunner(name = "Ana"): Promise<EnrolledRunner> {
  const reply = await asOperator<EnrolledRunnerView>("POST", "/operator/runners", {
    name,
    expiresAt: inFuture(runnerLinkLifetimeMs),
  });
  expect(reply.status).toBe(201);
  const prefix = `${appBaseUrl}/r/`;
  expect(reply.body.inboxUrl.startsWith(prefix)).toBe(true);
  return { view: reply.body, token: reply.body.inboxUrl.slice(prefix.length) };
}
