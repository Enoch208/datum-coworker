import { and, eq } from "drizzle-orm";
import {
  coworkerComments,
  type CoworkerCommentPurpose,
  type CoworkerCommentRow,
  type CoworkerCommentStatus,
  type Executor,
} from "@datum/db";
import type { Task } from "@datum/masumi";
import type { Coworker } from "./context";

export interface CommentIntent {
  readonly sokosumiTaskId: string;
  readonly purpose: CoworkerCommentPurpose;
  readonly round: number;
  readonly taskStatus: CoworkerCommentStatus | null;
  readonly body: string;
}

const whereIntent = (intent: Pick<CommentIntent, "sokosumiTaskId" | "purpose" | "round">) =>
  and(
    eq(coworkerComments.sokosumiTaskId, intent.sokosumiTaskId),
    eq(coworkerComments.purpose, intent.purpose),
    eq(coworkerComments.round, intent.round),
  );

export async function recordIntent(db: Executor, intent: CommentIntent): Promise<void> {
  await db.insert(coworkerComments).values(intent).onConflictDoNothing();
}

export async function storedComment(
  db: Executor,
  intent: Pick<CommentIntent, "sokosumiTaskId" | "purpose" | "round">,
): Promise<CoworkerCommentRow | null> {
  const [row] = await db.select().from(coworkerComments).where(whereIntent(intent));
  return row ?? null;
}

function postedEarlier(task: Task, coworkerId: string, row: CoworkerCommentRow) {
  return task.events.find(
    (event) =>
      event.actor?.type === "coworker" &&
      event.actor.id === coworkerId &&
      event.comment === row.body &&
      (event.status ?? null) === row.taskStatus,
  );
}

async function markPosted(db: Executor, row: CoworkerCommentRow, eventId: string): Promise<void> {
  await db
    .update(coworkerComments)
    .set({ eventId, postedAt: new Date() })
    .where(eq(coworkerComments.id, row.id));
}

export async function postRecorded(
  coworker: Coworker,
  key: Pick<CommentIntent, "sokosumiTaskId" | "purpose" | "round">,
): Promise<string> {
  const row = await storedComment(coworker.db, key);
  if (row === null)
    throw new Error(`No ${key.purpose} comment was recorded for Task ${key.sokosumiTaskId}`);
  if (row.eventId !== null) return row.eventId;
  const task = await coworker.core.task(row.sokosumiTaskId);
  const earlier = postedEarlier(task, coworker.coworkerId, row);
  if (earlier !== undefined) {
    coworker.log(`Task ${row.sokosumiTaskId}: the ${row.purpose} comment was already posted`);
    await markPosted(coworker.db, row, earlier.id);
    return earlier.id;
  }
  const event = await coworker.core.postEvent(
    row.sokosumiTaskId,
    row.taskStatus === null ? { comment: row.body } : { status: row.taskStatus, comment: row.body },
  );
  await markPosted(coworker.db, row, event.id);
  coworker.log(
    `Task ${row.sokosumiTaskId}: posted the ${row.purpose} comment as event ${event.id}`,
  );
  return event.id;
}

export async function postOnce(coworker: Coworker, intent: CommentIntent): Promise<string> {
  await recordIntent(coworker.db, intent);
  return postRecorded(coworker, intent);
}
