import { ApiRequestError } from "@/lib/http";

export interface StartFailure {
  readonly code: string | null;
  readonly message: string;
}

export const startFailureOf = (cause: unknown): StartFailure => ({
  code: cause instanceof ApiRequestError ? cause.code : null,
  message: cause instanceof Error ? cause.message : String(cause),
});

export const isPaymentWait = (failure: StartFailure | null): boolean =>
  failure?.code === "AWAITING_PAYMENT";
