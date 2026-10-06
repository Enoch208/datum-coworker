export class TerminalLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TerminalLifecycleError";
  }
}

export class HttpStatusError extends Error {
  readonly service: string;
  readonly status: number;
  readonly kind: string | null;

  constructor(service: string, status: number, detail: string, kind: string | null) {
    super(`${service} answered HTTP ${String(status)}: ${detail}`);
    this.name = "HttpStatusError";
    this.service = service;
    this.status = status;
    this.kind = kind;
  }
}

export function isHttpStatus(error: unknown, status: number): error is HttpStatusError {
  return error instanceof HttpStatusError && error.status === status;
}
