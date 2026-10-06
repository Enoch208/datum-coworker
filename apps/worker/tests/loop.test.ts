import { describe, expect, it } from "vitest";
import { runUntilAborted } from "../src/loop";

describe("runUntilAborted", () => {
  it("runs passes until the signal aborts, then returns cleanly", async () => {
    const controller = new AbortController();
    let passes = 0;
    await runUntilAborted(
      () => {
        passes += 1;
        if (passes === 3) controller.abort();
        return Promise.resolve();
      },
      controller.signal,
      1,
    );
    expect(passes).toBe(3);
  });

  it("stops a pass that honours the signal mid-step without treating it as a failure", async () => {
    const controller = new AbortController();
    await expect(
      runUntilAborted(
        (signal) => {
          controller.abort();
          signal.throwIfAborted();
          return Promise.resolve();
        },
        controller.signal,
        1,
      ),
    ).resolves.toBeUndefined();
  });

  it("surfaces a failure that is not a shutdown so the process supervisor restarts it", async () => {
    const controller = new AbortController();
    await expect(
      runUntilAborted(() => Promise.reject(new Error("database down")), controller.signal, 1),
    ).rejects.toThrow("database down");
  });

  it("never starts a pass once the signal has already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    let passes = 0;
    await runUntilAborted(
      () => {
        passes += 1;
        return Promise.resolve();
      },
      controller.signal,
      1,
    );
    expect(passes).toBe(0);
  });
});
