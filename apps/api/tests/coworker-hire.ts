import { eq } from "drizzle-orm";
import { campaigns, coworkerTasks } from "@datum/db";
import { loopDeps } from "./goal-loop/loop";
import { db } from "./support";

export const hiringTaskId = "01a11070-0000-7000-8000-00000000c0de";

export async function hireThroughTask(campaignId: string): Promise<void> {
  await db
    .update(campaigns)
    .set({ sokosumiTaskId: hiringTaskId })
    .where(eq(campaigns.id, campaignId));
  await db.insert(coworkerTasks).values({ sokosumiTaskId: hiringTaskId, stage: "CAMPAIGN" });
}

export const lockEscrow = () =>
  db
    .update(coworkerTasks)
    .set({ escrowTxHash: "2f04c890".padEnd(64, "0"), fundsLockedAt: new Date() })
    .where(eq(coworkerTasks.sokosumiTaskId, hiringTaskId));

export async function statusOf(campaignId: string) {
  const [row] = await db
    .select({ status: campaigns.status })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));
  return row?.status;
}

export const afterDeadline = (deadline: string) =>
  loopDeps({ now: () => new Date(Date.parse(deadline) + 60_000) });

export const never = new AbortController().signal;
