import { and, eq } from "drizzle-orm";
import { assertTransition, type CampaignStatus } from "@datum/core";
import { campaigns, type CampaignRow, type Executor } from "@datum/db";
import { conflict, notFound } from "../http/errors";
import { recordAudit } from "./audit";

export interface StatusSideEffects {
  readonly approvedAt?: Date | null;
}

export async function moveStatus(
  db: Executor,
  campaignId: string,
  from: CampaignStatus,
  to: CampaignStatus,
  sideEffects: StatusSideEffects = {},
): Promise<void> {
  assertTransition(from, to);
  const moved = await db
    .update(campaigns)
    .set({ status: to, ...sideEffects })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.status, from)))
    .returning({ id: campaigns.id });
  if (moved.length === 0) {
    throw conflict("CONFLICT", `Campaign ${campaignId} changed while this request ran; reload it`);
  }
  await recordAudit(db, campaignId, { type: "STATUS_CHANGED", payload: { from, to } });
}

export async function lockCampaign(db: Executor, campaignId: string): Promise<CampaignRow> {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .for("update");
  if (campaign === undefined) throw notFound("Campaign", campaignId);
  return campaign;
}
