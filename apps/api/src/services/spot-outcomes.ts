import { and, eq } from "drizzle-orm";
import {
  attemptStateOf,
  firstPassOutcome,
  spotOutcome,
  type SpotEvidenceHistory,
  type TimedVerdict,
} from "@datum/core";
import {
  campaigns,
  evidence,
  physicalTasks,
  spots,
  type EvidenceRow,
  type Executor,
  type PhysicalTaskRow,
  type SpotRow,
} from "@datum/db";

const timedVerdict = (
  photo: EvidenceRow,
  attempts: ReadonlyMap<string, number>,
): TimedVerdict[] => {
  const attempt = attempts.get(photo.physicalTaskId);
  if (attempt === undefined || photo.verdict === null) return [];
  return [
    {
      attempt,
      verdict: photo.verdict,
      failure: photo.failure,
      submittedAt: photo.submittedAt.toISOString(),
    },
  ];
};

export function spotHistory(
  spot: SpotRow,
  tasks: readonly PhysicalTaskRow[],
  photos: readonly EvidenceRow[],
): SpotEvidenceHistory {
  const placements = tasks.filter((task) => task.spotId === spot.id && task.type === "PLACE_SPOT");
  const attempts = new Map(placements.map((task) => [task.id, task.attempt]));
  return {
    spotCode: spot.code,
    attempts: placements.map((task) => ({
      attempt: task.attempt,
      state: attemptStateOf(task.status),
    })),
    evidence: photos
      .filter((photo) => photo.spotId === spot.id)
      .flatMap((photo) => timedVerdict(photo, attempts)),
  };
}

export async function refreshSpotOutcome(db: Executor, spotId: string): Promise<void> {
  const [row] = await db
    .select({ spot: spots, deadline: campaigns.deadline })
    .from(spots)
    .innerJoin(campaigns, eq(campaigns.id, spots.campaignId))
    .where(eq(spots.id, spotId));
  if (row === undefined) throw new Error(`Spot ${spotId} does not exist`);
  const tasks = await db.select().from(physicalTasks).where(eq(physicalTasks.spotId, spotId));
  const photos = await db.select().from(evidence).where(eq(evidence.spotId, spotId));
  const history = spotHistory(row.spot, tasks, photos);
  const deadline = row.deadline.toISOString();
  const status = spotOutcome(history, deadline);
  const firstPass =
    row.spot.firstPassStatus === "PENDING"
      ? firstPassOutcome(history, deadline)
      : row.spot.firstPassStatus;
  if (status === row.spot.status && firstPass === row.spot.firstPassStatus) return;
  await db
    .update(spots)
    .set({ status, firstPassStatus: firstPass })
    .where(and(eq(spots.id, spotId), eq(spots.firstPassStatus, row.spot.firstPassStatus)));
}

export async function refreshCampaignSpots(db: Executor, campaignId: string): Promise<void> {
  const rows = await db
    .select({ id: spots.id })
    .from(spots)
    .where(eq(spots.campaignId, campaignId));
  for (const row of rows) await refreshSpotOutcome(db, row.id);
}
