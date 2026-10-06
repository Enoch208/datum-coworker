import { and, eq, ne } from "drizzle-orm";
import {
  hasIdShape,
  campaigns,
  evidence,
  expenses,
  physicalTasks,
  spots,
  type CampaignRow,
  type Executor,
  type PhysicalTaskRow,
  type RunnerRow,
  type SpotRow,
} from "@datum/db";
import { HttpError } from "../http/errors";

export interface RunnerTask {
  readonly task: PhysicalTaskRow;
  readonly spot: SpotRow | null;
  readonly campaign: CampaignRow;
}

const taskNotFound = (): HttpError =>
  new HttpError(404, "NOT_FOUND", "This task is not on your list");

export async function runnerTask(
  db: Executor,
  runner: RunnerRow,
  taskId: string,
  lock = false,
): Promise<RunnerTask> {
  if (!hasIdShape("tsk", taskId)) throw taskNotFound();
  const query = db
    .select({ task: physicalTasks, spot: spots, campaign: campaigns })
    .from(physicalTasks)
    .innerJoin(campaigns, eq(campaigns.id, physicalTasks.campaignId))
    .leftJoin(spots, eq(spots.id, physicalTasks.spotId))
    .where(
      and(
        eq(physicalTasks.id, taskId),
        eq(physicalTasks.runnerId, runner.id),
        ne(physicalTasks.status, "CREATED"),
      ),
    );
  const [row] = lock ? await query.for("update", { of: physicalTasks }) : await query;
  if (row === undefined) throw taskNotFound();
  return row;
}

export const isOpenForWork = (task: PhysicalTaskRow): boolean =>
  task.status === "ACCEPTED" || task.status === "SUBMITTED";

export async function hasEvidence(db: Executor, taskId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: evidence.id })
    .from(evidence)
    .where(eq(evidence.physicalTaskId, taskId))
    .limit(1);
  return row !== undefined;
}

export async function hasExpense(db: Executor, taskId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(eq(expenses.physicalTaskId, taskId))
    .limit(1);
  return row !== undefined;
}
