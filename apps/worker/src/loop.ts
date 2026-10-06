import { setTimeout as sleep } from "node:timers/promises";

export const passIntervalMs = 3_000;

export type Pass = (signal: AbortSignal) => Promise<void>;

const isAbort = (thrown: unknown, signal: AbortSignal): boolean =>
  signal.aborted && thrown instanceof Error && thrown.name === "AbortError";

export async function runUntilAborted(
  pass: Pass,
  signal: AbortSignal,
  intervalMs = passIntervalMs,
): Promise<void> {
  while (!signal.aborted) {
    try {
      await pass(signal);
      await sleep(intervalMs, undefined, { signal });
    } catch (thrown) {
      if (isAbort(thrown, signal)) return;
      throw thrown;
    }
  }
}
