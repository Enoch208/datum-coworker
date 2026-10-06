import { CancelCircleIcon, CheckmarkBadge01Icon, HourglassIcon } from "@hugeicons/core-free-icons";
import type { SpotOutcome } from "@datum/core";
import { ToneChip, type ChipSpec } from "./tone-chip";

const spotSpecs: Record<SpotOutcome, ChipSpec> = {
  PENDING: { tone: "quiet", icon: HourglassIcon, label: "Waiting for proof" },
  PASS: { tone: "ok", icon: CheckmarkBadge01Icon, label: "Pass" },
  MISS: { tone: "danger", icon: CancelCircleIcon, label: "Miss" },
};

export function SpotStatusChip({ status }: { status: SpotOutcome }) {
  return <ToneChip {...spotSpecs[status]} />;
}
