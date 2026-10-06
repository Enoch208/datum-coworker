import type { z } from "zod";
import { apiErrorSchema } from "./wire-schemas";

export const apiBase = "/api";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

const notJson = (status: number): ApiRequestError =>
  new ApiRequestError(
    status,
    "BAD_RESPONSE",
    "Datum's API answered with something that is not JSON.",
  );

function parseJson(text: string, status: number): unknown {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    throw notJson(status);
  }
}

function failure(status: number, body: unknown): ApiRequestError {
  const known = apiErrorSchema.safeParse(body);
  if (known.success) return new ApiRequestError(status, known.data.error, known.data.message);
  if (status >= 502 && status <= 504) {
    return new ApiRequestError(status, "UNREACHABLE", "Datum's API is not responding right now.");
  }
  return new ApiRequestError(
    status,
    "UNEXPLAINED",
    `Datum's API answered ${String(status)} without an explanation.`,
  );
}

export function readBody(status: number, contentType: string | null, text: string): unknown {
  const isJson = contentType?.includes("application/json") ?? false;
  const body: unknown = isJson && text.length > 0 ? parseJson(text, status) : null;
  if (status < 200 || status >= 300) throw failure(status, body);
  if (!isJson && text.length > 0) throw notJson(status);
  return body;
}

export function expectShape<T>(schema: z.ZodType<T>, body: unknown, what: string): T {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  const where = parsed.error.issues[0]?.path.join(".") ?? "";
  const detail = where.length > 0 ? ` (at ${where})` : "";
  throw new ApiRequestError(
    200,
    "BAD_SHAPE",
    `Datum's API returned ${what} in a shape this page does not recognise${detail}.`,
  );
}

export async function send(path: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers:
        init.body === undefined
          ? { Accept: "application/json" }
          : { Accept: "application/json", "Content-Type": "application/json" },
    });
  } catch (cause) {
    if (init.signal?.aborted) throw cause;
    throw new ApiRequestError(0, "NETWORK", "Datum's API could not be reached. Try again.");
  }
  const text = await response.text();
  return readBody(response.status, response.headers.get("content-type"), text);
}
