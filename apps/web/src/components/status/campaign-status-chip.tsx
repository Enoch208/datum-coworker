import {
  Alert02Icon,
  CancelCircleIcon,
  CheckmarkBadge01Icon,
  CheckmarkCircle02Icon,
  DashedLineCircleIcon,
  Hourglass,
  PlayCircleIcon,
  RepairIcon,
  ScanIcon,
  StopCircleIcon,
  TimeQuarterPassIcon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import type { CampaignStatus } from "@datum/core";
import { ToneChip, type ChipSpec } from "./tone-chip";

const statusSpecs: Record<CampaignStatus, ChipSpec> = {
  DRAFT: { tone: "quiet", icon: DashedLineCircleIcon, label: "Draft" },
  PLANNING: { tone: "neutral", icon: Hourglass, label: "Planning" },
  AWAITING_APPROVAL: { tone: "neutral", icon: UserCheck01Icon, label: "Awaiting approval" },
  APPROVED: { tone: "ok", icon: CheckmarkCircle02Icon, label: "Approved" },
  EXECUTING: { tone: "ok", icon: PlayCircleIcon, label: "Executing" },
  VERIFYING: { tone: "neutral", icon: ScanIcon, label: "Verifying" },
  REMEDIATING: { tone: "warn", icon: RepairIcon, label: "Remediating" },
  COMPLETED: { tone: "ok", icon: CheckmarkBadge01Icon, label: "Completed" },
  EXPIRED_INCOMPLETE: { tone: "danger", icon: TimeQuarterPassIcon, label: "Expired incomplete" },
  FAILED: { tone: "danger", icon: CancelCircleIcon, label: "Failed" },
  CANCELLED: { tone: "quiet", icon: StopCircleIcon, label: "Cancelled" },
  NEEDS_APPROVAL: { tone: "warn", icon: Alert02Icon, label: "Needs approval" },
};

export function CampaignStatusChip({ status }: { status: CampaignStatus }) {
  return <ToneChip {...statusSpecs[status]} />;
}
