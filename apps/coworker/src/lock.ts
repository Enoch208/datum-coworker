import type { Db } from "@datum/db";

export type Locked<Result> = { acquired: true; result: Result } | { acquired: false };

const lockName = (sokosumiTaskId: string): string => `datum:coworker-task:${sokosumiTaskId}`;

export async function withTaskLock<Result>(
  db: Db,
  sokosumiTaskId: string,
  run: () => Promise<Result>,
): Promise<Locked<Result>> {
  const session = await db.$client.reserve();
  const name = lockName(sokosumiTaskId);
  try {
    const [row] = await session<{ locked: boolean }[]>`
      select pg_try_advisory_lock(hashtextextended(${name}, 0)) as locked`;
    if (row?.locked !== true) return { acquired: false };
    try {
      return { acquired: true, result: await run() };
    } finally {
      await session`select pg_advisory_unlock(hashtextextended(${name}, 0))`;
    }
  } finally {
    session.release();
  }
}
