import { eq } from "drizzle-orm";
import type { CampaignStatus } from "@datum/core";
import { campaigns } from "@datum/db";
import { lockCampaign, moveStatus } from "../services/status";
import type { LoopDeps } from "./deps";
import { expireCampaign } from "./finish";

const beforeApproval: ReadonlySet<CampaignStatus> = new Set([
  "DRAFT",
  "PLANNING",
  "AWAITING_APPROVAL",
]);

export async function expireUnstartedCampaign(
  deps: LoopDeps,
  campaignId: string,
  signal: AbortSignal,
): Promise<boolean> {
  const [campaign] = await deps.db
    .select({ status: campaigns.status, deadline: campaigns.deadline })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));
  if (campaign === undefined || deps.now().getTime() <= campaign.deadline.getTime()) return false;
  if (campaign.status === "APPROVED") {
    await expireCampaign(deps, campaignId, signal);
    return true;
  }
  if (!beforeApproval.has(campaign.status)) return false;
  return deps.db.transaction(async (tx) => {
    const locked = await lockCampaign(tx, campaignId);
    if (!beforeApproval.has(locked.status)) return false;
    await moveStatus(tx, campaignId, locked.status, "EXPIRED_INCOMPLETE");
    return true;
  });
}
