import type {
  ApproveCampaignRequest,
  CampaignView,
  CreateCampaignRequest,
  EditCopyRequest,
  TimelineEventView,
} from "@datum/core";
import type { z } from "zod";
import {
  apiErrorSchema,
  campaignViewSchema,
  createdCampaignSchema,
  timelineSchema,
} from "./wire-schemas";

const apiBase = "/api";

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

const campaignPath = (id: string): string => `/campaigns/${encodeURIComponent(id)}`;

async function reach(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${apiBase}${path}`, {
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
}

function parseJson(text: string, status: number): unknown {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    throw new ApiRequestError(
      status,
      "BAD_RESPONSE",
      "Datum's API answered with something that is not JSON.",
    );
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

async function send(path: string, init: RequestInit): Promise<unknown> {
  const response = await reach(path, init);
  const text = await response.text();
  const isJson = response.headers.get("content-type")?.includes("application/json") ?? false;
  const body: unknown = isJson && text.length > 0 ? parseJson(text, response.status) : null;
  if (!response.ok) throw failure(response.status, body);
  if (!isJson && text.length > 0) {
    throw new ApiRequestError(
      response.status,
      "BAD_RESPONSE",
      "Datum's API answered with something that is not JSON.",
    );
  }
  return body;
}

function expect<T>(schema: z.ZodType<T>, body: unknown, what: string): T {
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

const json = (body: unknown): string => JSON.stringify(body);

export async function createCampaign(request: CreateCampaignRequest): Promise<string> {
  const body = await send("/campaigns", { method: "POST", body: json(request) });
  return expect(createdCampaignSchema, body, "the new campaign").id;
}

export async function getCampaign(id: string, signal: AbortSignal): Promise<CampaignView> {
  const body = await send(campaignPath(id), { method: "GET", signal });
  return expect(campaignViewSchema, body, "the campaign");
}

export async function getTimeline(id: string, signal: AbortSignal): Promise<TimelineEventView[]> {
  const body = await send(`${campaignPath(id)}/timeline`, { method: "GET", signal });
  return expect(timelineSchema, body, "the timeline");
}

export async function requestPlan(id: string): Promise<void> {
  await send(`${campaignPath(id)}/plan`, { method: "POST" });
}

export async function approveCampaign(id: string, request: ApproveCampaignRequest): Promise<void> {
  await send(`${campaignPath(id)}/approve`, { method: "POST", body: json(request) });
}

export async function editCopy(id: string, request: EditCopyRequest): Promise<void> {
  await send(`${campaignPath(id)}/copy`, { method: "PATCH", body: json(request) });
}
