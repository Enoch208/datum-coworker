import { and, eq, ne } from "drizzle-orm";
import { spots, type Executor } from "@datum/db";

export async function recordSpotPass(db: Executor, spotId: string, attempt: number): Promise<void> {
  await db
    .update(spots)
    .set(attempt === 1 ? { status: "PASS", firstPassStatus: "PASS" } : { status: "PASS" })
    .where(eq(spots.id, spotId));
}

export async function closeSpotAttempt(
  db: Executor,
  spotId: string,
  attempt: number,
): Promise<void> {
  await db
    .update(spots)
    .set({ status: "MISS" })
    .where(and(eq(spots.id, spotId), ne(spots.status, "PASS")));
  if (attempt !== 1) return;
  await db
    .update(spots)
    .set({ firstPassStatus: "MISS" })
    .where(and(eq(spots.id, spotId), eq(spots.firstPassStatus, "PENDING")));
}
