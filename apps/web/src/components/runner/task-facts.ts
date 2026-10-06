import type {
  EvidenceView,
  ExpenseView,
  PhysicalTaskStatus,
  PhysicalTaskType,
  RunnerTaskView,
} from "@datum/core";

const typeRank: Record<PhysicalTaskType, number> = { PRINT_AND_COLLECT: 0, PLACE_SPOT: 1 };

const handedInStatuses: readonly PhysicalTaskStatus[] = [
  "SUBMITTED",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
];

const spotOrder = (left: RunnerTaskView, right: RunnerTaskView): number =>
  (left.spot?.code ?? "").localeCompare(right.spot?.code ?? "", "en", { numeric: true });

export function inRunOrder(tasks: readonly RunnerTaskView[]): RunnerTaskView[] {
  return [...tasks].sort(
    (left, right) =>
      typeRank[left.type] - typeRank[right.type] ||
      spotOrder(left, right) ||
      left.attempt - right.attempt,
  );
}

export const isHandedIn = (status: PhysicalTaskStatus): boolean =>
  handedInStatuses.includes(status);

export const awaitsAcceptance = (status: PhysicalTaskStatus): boolean =>
  status === "CREATED" || status === "DISPATCHED";

export function taskTitle(task: RunnerTaskView): string {
  if (task.type === "PRINT_AND_COLLECT") return "Print and collect the cards";
  return task.spot === null ? "Place the card" : `Place the card at Spot ${task.spot.code}`;
}

function latestEvidence(evidence: readonly EvidenceView[]): EvidenceView | null {
  return evidence.reduce<EvidenceView | null>(
    (latest, item) =>
      latest === null || Date.parse(item.submittedAt) >= Date.parse(latest.submittedAt)
        ? item
        : latest,
    null,
  );
}

export function shownEvidence(
  task: RunnerTaskView,
  uploaded: EvidenceView | null,
): EvidenceView | null {
  if (uploaded === null) return latestEvidence(task.evidence);
  return task.evidence.find((item) => item.id === uploaded.id) ?? uploaded;
}

export function shownExpense(
  task: RunnerTaskView,
  submitted: ExpenseView | null,
): ExpenseView | null {
  if (submitted === null) return task.expense;
  return task.expense !== null && task.expense.id === submitted.id ? task.expense : submitted;
}
