export const brandPageFailures = [
  "UNSUPPORTED_URL",
  "BLOCKED_ADDRESS",
  "DNS_FAILED",
  "TIMEOUT",
  "HTTP_STATUS",
  "NOT_HTML",
  "UNSUPPORTED_ENCODING",
  "TOO_LARGE",
  "TOO_MANY_REDIRECTS",
  "NETWORK",
] as const;
export type BrandPageFailure = (typeof brandPageFailures)[number];

export class BrandPageError extends Error {
  readonly code: BrandPageFailure;

  constructor(code: BrandPageFailure, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BrandPageError";
    this.code = code;
  }
}

const dnsFailureCodes: ReadonlySet<unknown> = new Set(["ENOTFOUND", "EAI_AGAIN", "ENODATA"]);

export function networkFailure(error: Error, timedOut: boolean, timeoutMs: number): BrandPageError {
  if (error instanceof BrandPageError) return error;
  if (timedOut) {
    return new BrandPageError(
      "TIMEOUT",
      `the page did not answer within ${String(timeoutMs / 1000)} seconds`,
      { cause: error },
    );
  }
  const code = "code" in error ? error.code : undefined;
  if (dnsFailureCodes.has(code)) {
    return new BrandPageError("DNS_FAILED", "its address could not be resolved", { cause: error });
  }
  return new BrandPageError("NETWORK", `the connection failed (${error.message})`, {
    cause: error,
  });
}
