import { and, eq } from "drizzle-orm";
import { campaigns, scanEvents, spots, type Executor } from "@datum/db";
import { notFound } from "../http/errors";

const userAgentMaxLength = 256;

export async function recordScan(
  db: Executor,
  campaignId: string,
  spotCode: string,
  userAgent: string | undefined,
): Promise<string> {
  const [target] = await db
    .select({ spotId: spots.id, destinationUrl: campaigns.destinationUrl })
    .from(spots)
    .innerJoin(campaigns, eq(spots.campaignId, campaigns.id))
    .where(and(eq(spots.campaignId, campaignId), eq(spots.code, spotCode)));
  if (target === undefined) {
    throw notFound("Spot", `${campaignId}/${spotCode}`);
  }
  await db.insert(scanEvents).values({
    spotId: target.spotId,
    userAgent: userAgent === undefined ? null : userAgent.slice(0, userAgentMaxLength),
  });
  return target.destinationUrl;
}
