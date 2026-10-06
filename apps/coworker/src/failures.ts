import { HttpStatusError, TerminalLifecycleError } from "@datum/masumi";

export type Failure =
  | { readonly kind: "NEEDS_HUMAN"; readonly action: string }
  | { readonly kind: "STOP"; readonly reason: string }
  | { readonly kind: "RETRY"; readonly reason: string };

const httpCause = (error: unknown): HttpStatusError | null => {
  if (error instanceof HttpStatusError) return error;
  if (error instanceof Error && error.cause instanceof HttpStatusError) return error.cause;
  return null;
};

const grantActions = (organizationTask: boolean): Readonly<Record<string, string>> => ({
  grant_required: organizationTask
    ? "An owner or admin of the Task's organization Workspace must approve Datum's Vendor access request in Sokosumi."
    : "The Task owner must approve Datum's Vendor access request in their Personal Workspace notifications on Sokosumi.",
  grant_denied:
    "A Workspace owner or admin must reverse the denied Vendor access for Datum in Sokosumi.",
  grant_revoked:
    "A Workspace owner or admin must restore the revoked Vendor access for Datum in Sokosumi.",
});

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function classifyFailure(error: unknown, organizationTask: boolean): Failure {
  const http = httpCause(error);
  if (http?.status === 403 && http.kind !== null) {
    const action = grantActions(organizationTask)[http.kind];
    if (action !== undefined) {
      return { kind: "NEEDS_HUMAN", action: `${action} Datum retries this same Task after that.` };
    }
  }
  if (error instanceof TerminalLifecycleError) return { kind: "STOP", reason: describe(error) };
  return { kind: "RETRY", reason: describe(error) };
}
