import { assertAsciiSafeResult } from "../hash";
import type { WorkInput } from "../lifecycle/deps";

export function gate0Result(input: WorkInput): string {
  const text = `Datum Gate 0 result for Sokosumi Task ${input.taskId}: the paid Coworker lifecycle ran after confirmed escrow. Input hash ${input.inputHash}.`;
  assertAsciiSafeResult(text);
  return text;
}
