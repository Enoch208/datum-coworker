import type { ContentfulStatusCode } from "hono/utils/http-status";

export function errorBody(error: string, message: string) {
  return { error, message };
}

export class HttpError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: string;

  constructor(status: ContentfulStatusCode, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }

  toBody() {
    return errorBody(this.code, this.message);
  }
}

export function notFound(what: string, id: string): HttpError {
  return new HttpError(404, "NOT_FOUND", `${what} ${id} does not exist`);
}

export function invalidRequest(message: string): HttpError {
  return new HttpError(400, "VALIDATION_FAILED", message);
}

export function conflict(code: string, message: string): HttpError {
  return new HttpError(409, code, message);
}

export function unprocessable(code: string, message: string): HttpError {
  return new HttpError(422, code, message);
}

export function upstreamFailed(code: string, message: string): HttpError {
  return new HttpError(502, code, message);
}

export function unavailable(code: string, message: string): HttpError {
  return new HttpError(503, code, message);
}
