import { asc, inArray } from "drizzle-orm";
import type { CampaignStatus } from "@datum/core";
import { campaigns, type Db } from "@datum/db";

export const loopStatuses = [
  "EXECUTING",
  "VERIFYING",
  "REMEDIATING",
  "NEEDS_APPROVAL",
] as const satisfies readonly CampaignStatus[];

const loopStatusSet: ReadonlySet<CampaignStatus> = new Set(loopStatuses);

export const isLoopStatus = (status: CampaignStatus): boolean => loopStatusSet.has(status);

export async function loopCampaignIds(db: Db): Promise<string[]> {
  const rows = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(inArray(campaigns.status, [...loopStatuses]))
    .orderBy(asc(campaigns.createdAt), asc(campaigns.id));
  return rows.map((row) => row.id);
}

export type LockedRun<Result> = { acquired: true; result: Result } | { acquired: false };

const lockName = (campaignId: string): string => `datum:goal-loop:${campaignId}`;

export async function withCampaignLock<Result>(
  db: Db,
  campaignId: string,
  run: () => Promise<Result>,
): Promise<LockedRun<Result>> {
  const session = await db.$client.reserve();
  const name = lockName(campaignId);
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
