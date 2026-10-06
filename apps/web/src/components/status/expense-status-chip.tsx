import { Alert02Icon, CheckmarkBadge01Icon, HourglassIcon } from "@hugeicons/core-free-icons";
import type { ExpenseStatus } from "@datum/core";
import { ToneChip, type ChipSpec } from "./tone-chip";

const expenseSpecs: Record<ExpenseStatus, ChipSpec> = {
  SUBMITTED: { tone: "neutral", icon: HourglassIcon, label: "Waiting for confirmation" },
  CONFIRMED: { tone: "ok", icon: CheckmarkBadge01Icon, label: "Confirmed" },
  DISPUTED: { tone: "warn", icon: Alert02Icon, label: "Disputed" },
};

export function ExpenseStatusChip({ status }: { status: ExpenseStatus }) {
  return <ToneChip {...expenseSpecs[status]} />;
}
