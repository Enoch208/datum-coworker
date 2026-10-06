import { and, asc, desc, eq, inArray, ne, notInArray, type SQL } from "drizzle-orm";
import {
  finalCampaignStatuses,
  toWireMoney,
  type RunnerInboxView,
  type RunnerTaskView,
  type SpotCardView,
} from "@datum/core";
import {
  brands,
  campaigns,
  evidence,
  expenses,
  physicalTasks,
  spots,
  type EvidenceRow,
  type Executor,
  type ExpenseRow,
  type RunnerRow,
} from "@datum/db";
import { cardAssetKey, cardAssetUrl } from "../cards/store";
import { toEvidenceView } from "../views/evidence";
import { toExpenseView } from "../views/ledger";
import type { RunnerTask } from "./tasks";

interface InboxRow extends RunnerTask {
  readonly brandName: string;
}

const inboxRows = (db: Executor, runner: RunnerRow, scope: SQL | undefined) =>
  db
    .select({ task: physicalTasks, spot: spots, campaign: campaigns, brandName: brands.name })
    .from(physicalTasks)
    .innerJoin(campaigns, eq(campaigns.id, physicalTasks.campaignId))
    .innerJoin(brands, eq(brands.id, campaigns.brandId))
    .leftJoin(spots, eq(spots.id, physicalTasks.spotId))
    .where(and(eq(physicalTasks.runnerId, runner.id), ne(physicalTasks.status, "CREATED"), scope))
    .orderBy(desc(campaigns.createdAt), asc(physicalTasks.idempotencyKey));

const card = (appBaseUrl: string, row: InboxRow, spotCode: string): SpotCardView => {
  const url = (file: "png" | "pdf") =>
    cardAssetUrl(appBaseUrl, cardAssetKey(row.campaign.id, row.task.assetVersion, spotCode, file));
  return { pngUrl: url("png"), pdfUrl: url("pdf") };
};

interface Attachments {
  readonly spotCodes: ReadonlyMap<string, string[]>;
  readonly evidence: readonly EvidenceRow[];
  readonly expenses: readonly ExpenseRow[];
}

async function attachments(db: Executor, rows: readonly InboxRow[]): Promise<Attachments> {
  const taskIds = rows.map(({ task }) => task.id);
  const campaignIds = [...new Set(rows.map(({ campaign }) => campaign.id))];
  if (taskIds.length === 0) return { spotCodes: new Map(), evidence: [], expenses: [] };
  const campaignSpots = await db
    .select({ campaignId: spots.campaignId, code: spots.code })
    .from(spots)
    .where(inArray(spots.campaignId, campaignIds))
    .orderBy(asc(spots.code));
  const spotCodes = new Map<string, string[]>();
  for (const spot of campaignSpots) {
    spotCodes.set(spot.campaignId, [...(spotCodes.get(spot.campaignId) ?? []), spot.code]);
  }
  return {
    spotCodes,
    evidence: await db
      .select()
      .from(evidence)
      .where(inArray(evidence.physicalTaskId, taskIds))
      .orderBy(asc(evidence.submittedAt), asc(evidence.id)),
    expenses: await db
      .select()
      .from(expenses)
      .where(inArray(expenses.physicalTaskId, taskIds))
      .orderBy(asc(expenses.createdAt), asc(expenses.id)),
  };
}

const currentExpense = (all: readonly ExpenseRow[], taskId: string): ExpenseRow | null => {
  const own = all.filter((expense) => expense.physicalTaskId === taskId);
  return own.findLast((expense) => expense.status !== "DISPUTED") ?? own.at(-1) ?? null;
};

function toRunnerTaskView(appBaseUrl: string, row: InboxRow, extra: Attachments): RunnerTaskView {
  const { task, spot, campaign } = row;
  const spotCode = spot?.code ?? null;
  const cardCodes = spotCode === null ? (extra.spotCodes.get(campaign.id) ?? []) : [spotCode];
  const expense = currentExpense(extra.expenses, task.id);
  return {
    id: task.id,
    campaignId: campaign.id,
    brandName: row.brandName,
    type: task.type,
    attempt: task.attempt,
    status: task.status,
    spot:
      spot === null ? null : { code: spot.code, name: spot.name, instructions: spot.instructions },
    instructions: task.instructions,
    cards: cardCodes.map((code) => card(appBaseUrl, row, code)),
    dueBy: task.dueBy.toISOString(),
    estimatedCost: toWireMoney({ amountMinor: task.estimatedCostMinor, currency: task.currency }),
    evidence: extra.evidence
      .filter((photo) => photo.physicalTaskId === task.id)
      .map((photo) => toEvidenceView(photo, spotCode, appBaseUrl)),
    expense: expense === null ? null : toExpenseView(expense, appBaseUrl),
  };
}

async function taskViews(
  db: Executor,
  appBaseUrl: string,
  runner: RunnerRow,
  scope: SQL | undefined,
): Promise<RunnerTaskView[]> {
  const rows = await inboxRows(db, runner, scope);
  const extra = await attachments(db, rows);
  return rows.map((row) => toRunnerTaskView(appBaseUrl, row, extra));
}

export async function runnerInbox(
  db: Executor,
  appBaseUrl: string,
  runner: RunnerRow,
): Promise<RunnerInboxView> {
  const live = notInArray(campaigns.status, [...finalCampaignStatuses]);
  return {
    runner: { id: runner.id, name: runner.name },
    tasks: await taskViews(db, appBaseUrl, runner, live),
  };
}

export async function runnerTaskView(
  db: Executor,
  appBaseUrl: string,
  runner: RunnerRow,
  taskId: string,
): Promise<RunnerTaskView> {
  const [view] = await taskViews(db, appBaseUrl, runner, eq(physicalTasks.id, taskId));
  if (view === undefined) throw new Error(`Task ${taskId} vanished from runner ${runner.id}`);
  return view;
}
