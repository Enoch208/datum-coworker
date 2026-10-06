import type { PhysicalTaskType } from "@datum/core";

interface Orderable {
  readonly type: PhysicalTaskType;
  readonly attempt: number;
}

const typeRank: Record<PhysicalTaskType, number> = { PRINT_AND_COLLECT: 0, PLACE_SPOT: 1 };

export function inRunOrder<T extends Orderable>(
  tasks: readonly T[],
  spotCode: (task: T) => string | null,
): T[] {
  const code = (task: T) => spotCode(task) ?? "";
  return [...tasks].sort(
    (left, right) =>
      typeRank[left.type] - typeRank[right.type] ||
      code(left).localeCompare(code(right), "en", { numeric: true }) ||
      left.attempt - right.attempt,
  );
}
