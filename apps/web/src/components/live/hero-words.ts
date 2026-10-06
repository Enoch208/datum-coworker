import {
  isOpenTaskStatus,
  type CampaignStatus,
  type CampaignView,
  type GoalStateView,
} from "@datum/core";
import { formatSgtHour, plural, spotList } from "@/lib/format";

const headlines: Partial<Record<CampaignStatus, string>> = {
  EXECUTING: "Datum is working",
  VERIFYING: "Checking the evidence",
  REMEDIATING: "Problem found — recovering automatically",
  NEEDS_APPROVAL: "Needs your approval",
  COMPLETED: "Campaign live",
  EXPIRED_INCOMPLETE: "Expired before every spot was live",
  FAILED: "Campaign failed",
  CANCELLED: "Campaign cancelled",
};

export const heroHeadline = (status: CampaignStatus): string =>
  headlines[status] ?? "Datum is working";

const recoveringCodes = (campaign: CampaignView): string[] =>
  campaign.spots
    .filter((spot) => spot.firstPassStatus === "MISS" && spot.status !== "PASS")
    .map((spot) => spot.code);

const printOpen = (campaign: CampaignView): boolean =>
  campaign.tasks.some((task) => task.type === "PRINT_AND_COLLECT" && isOpenTaskStatus(task.status));

function executingDetail(campaign: CampaignView): string {
  const recovering = recoveringCodes(campaign);
  if (recovering.length > 0) {
    return `${spotList(recovering)} missed on the first pass. Datum commissioned the recovery on its own and is waiting for the new photo.`;
  }
  if (printOpen(campaign)) {
    return "The cards are being printed. Placements go out once the print receipt is confirmed.";
  }
  const waiting = campaign.spots.filter((spot) => spot.status !== "PASS").length;
  return `${plural(waiting, "spot")} still waiting for a photo that shows the spot's own QR code.`;
}

function remediatingDetail(campaign: CampaignView, goal: GoalStateView | null): string {
  const codes =
    goal === null
      ? campaign.spots.filter((spot) => spot.status === "MISS").map((spot) => spot.code)
      : goal.unresolved.map((item) => item.spotCode);
  const subject = codes.length === 0 ? "A spot" : spotList(codes);
  return `${subject} has no valid proof. Datum is planning the recovery itself, inside the remaining budget and before the deadline.`;
}

const recoveredCount = (campaign: CampaignView): number =>
  campaign.spots.filter((spot) => spot.firstPassStatus === "MISS" && spot.status === "PASS").length;

function completedDetail(campaign: CampaignView): string {
  const firstPass = campaign.spots.filter((spot) => spot.firstPassStatus === "PASS").length;
  const recovered = recoveredCount(campaign);
  const how =
    recovered === 0
      ? `all ${String(firstPass)} on the first pass`
      : `${String(firstPass)} on the first pass, ${String(recovered)} recovered automatically after a miss`;
  const since =
    campaign.completedAt === null ? "" : ` Live since ${formatSgtHour(campaign.completedAt)}.`;
  return `Every approved spot is verified with its own photo: ${how}.${since}`;
}

export function heroDetail(campaign: CampaignView, goal: GoalStateView | null): string {
  switch (campaign.status) {
    case "EXECUTING":
      return executingDetail(campaign);
    case "VERIFYING":
      return "Datum is checking every photo against the approved spots.";
    case "REMEDIATING":
      return remediatingDetail(campaign, goal);
    case "NEEDS_APPROVAL":
      return "Datum stopped at the edge of the authority you gave it. Nothing more is spent or commissioned until you decide below.";
    case "COMPLETED":
      return completedDetail(campaign);
    case "EXPIRED_INCOMPLETE": {
      const open = campaign.spots.filter((spot) => spot.status !== "PASS").length;
      return `The deadline passed with ${plural(open, "spot")} unresolved. Datum takes no new action after the deadline.`;
    }
    default:
      return "";
  }
}
