import {
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  RepairIcon,
  SentIcon,
  Task01Icon,
  TimeQuarterPassIcon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import type { PhysicalTaskStatus } from "@datum/core";
import { ToneChip, type ChipSpec } from "./tone-chip";

const customerSpecs: Record<PhysicalTaskStatus, ChipSpec> = {
  CREATED: { tone: "quiet", icon: Task01Icon, label: "Created" },
  DISPATCHED: { tone: "neutral", icon: SentIcon, label: "Sent to runner" },
  ACCEPTED: { tone: "neutral", icon: UserCheck01Icon, label: "Accepted" },
  SUBMITTED: { tone: "neutral", icon: SentIcon, label: "Handed in" },
  COMPLETED: { tone: "ok", icon: CheckmarkCircle02Icon, label: "Done" },
  CANCELLED: { tone: "quiet", icon: CancelCircleIcon, label: "Cancelled" },
  EXPIRED: { tone: "danger", icon: TimeQuarterPassIcon, label: "Expired" },
};

const runnerSpecs: Record<PhysicalTaskStatus, ChipSpec> = {
  ...customerSpecs,
  CREATED: { tone: "neutral", icon: Task01Icon, label: "New" },
  DISPATCHED: { tone: "neutral", icon: Task01Icon, label: "New" },
};

export function TaskStatusChip({
  status,
  audience,
}: {
  status: PhysicalTaskStatus;
  audience: "runner" | "customer";
}) {
  const specs = audience === "runner" ? runnerSpecs : customerSpecs;
  return <ToneChip {...specs[status]} />;
}

export const attemptLabel = (attempt: number): string =>
  attempt > 1 ? `Attempt ${String(attempt)} — recovery` : `Attempt ${String(attempt)}`;

export function RecoveryChip({ attempt }: { attempt: number }) {
  if (attempt <= 1) return null;
  return <ToneChip tone="warn" icon={RepairIcon} label={attemptLabel(attempt)} />;
}
