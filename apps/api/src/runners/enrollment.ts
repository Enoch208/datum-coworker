import { and, asc, eq, gt } from "drizzle-orm";
import type { EnrolledRunnerView, OperatorRunnerView } from "@datum/core";
import { runners, type Executor, type RunnerRow } from "@datum/db";
import { HttpError, notFound } from "../http/errors";
import type { EnrollRunnerInput } from "../http/operator-schemas";
import { hashInboxToken, inboxUrl, isInboxToken, newInboxToken } from "./inbox-token";

const toOperatorView = (runner: RunnerRow): OperatorRunnerView => ({
  id: runner.id,
  name: runner.name,
  active: runner.active,
  expiresAt: runner.tokenExpiresAt.toISOString(),
  createdAt: runner.createdAt.toISOString(),
});

export async function enrollRunner(
  db: Executor,
  appBaseUrl: string,
  input: EnrollRunnerInput,
): Promise<EnrolledRunnerView> {
  const token = newInboxToken();
  const [runner] = await db
    .insert(runners)
    .values({
      name: input.name,
      inboxTokenHash: hashInboxToken(token),
      tokenExpiresAt: input.expiresAt,
    })
    .returning();
  if (runner === undefined) throw new Error("Enrolling a runner returned no row");
  return { runner: toOperatorView(runner), inboxUrl: inboxUrl(appBaseUrl, token) };
}

export async function listRunners(db: Executor): Promise<OperatorRunnerView[]> {
  const rows = await db.select().from(runners).orderBy(asc(runners.createdAt), asc(runners.id));
  return rows.map(toOperatorView);
}

export async function deactivateRunner(
  db: Executor,
  runnerId: string,
): Promise<OperatorRunnerView> {
  const [runner] = await db
    .update(runners)
    .set({ active: false })
    .where(eq(runners.id, runnerId))
    .returning();
  if (runner === undefined) throw notFound("Runner", runnerId);
  return toOperatorView(runner);
}

const linkNotFound = (): HttpError =>
  new HttpError(404, "NOT_FOUND", "This runner link does not open any tasks");

export async function runnerForToken(db: Executor, token: string): Promise<RunnerRow> {
  if (!isInboxToken(token)) throw linkNotFound();
  const [runner] = await db
    .select()
    .from(runners)
    .where(
      and(
        eq(runners.inboxTokenHash, hashInboxToken(token)),
        eq(runners.active, true),
        gt(runners.tokenExpiresAt, new Date()),
      ),
    );
  if (runner === undefined) throw linkNotFound();
  return runner;
}
