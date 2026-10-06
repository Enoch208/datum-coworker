import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { minuteMs } from "../src/constants";
import { HttpStatusError, TerminalLifecycleError } from "../src/errors";
import { sokosumiResultHash } from "../src/hash";
import type { LifecycleDeps } from "../src/lifecycle/deps";
import type { PaymentSchedule } from "../src/schedule";
import { ProcessKilled } from "./support/clock";
import { scenario } from "./support/scenario";

const longSchedule =
  (deadlineMs: number) =>
  (nowMs: number): PaymentSchedule => ({
    payByTime: nowMs + 12 * minuteMs,
    submitResultTime: deadlineMs + 30 * minuteMs,
    unlockTime: deadlineMs + 46 * minuteMs,
    externalDisputeUnlockTime: deadlineMs + 62 * minuteMs,
  });

describe("paid work that finishes later", () => {
  it("requests terms on the schedule the work needs and waits for the result", async () => {
    const { clock, world, run, deps } = await scenario();
    const deadline = clock.now() + 90 * minuteMs;
    const readyAt = deadline - 5 * minuteMs;
    let asked = 0;
    const later: LifecycleDeps = {
      ...deps(),
      schedule: longSchedule(deadline),
      produceResult: () => {
        asked += 1;
        return Promise.resolve(clock.now() >= readyAt ? "Campaign finished." : null);
      },
    };
    const verified = await run(later);

    expect(Number(verified.terms.submitResultTime)).toBe(deadline + 30 * minuteMs);
    expect(Number(verified.terms.unlockTime)).toBe(deadline + 46 * minuteMs);
    expect(asked).toBeGreaterThan(1);
    expect(world.submitted?.at).toBeGreaterThanOrEqual(readyAt);
    expect(verified.result.text).toBe("Campaign finished.");
    expect(world.calls).toEqual({ start: 1, terms: 1, attach: 1, submit: 1, complete: 1 });
  });

  it("gives up honestly when the work is still unfinished inside the submit window", async () => {
    const { clock, world, run, deps } = await scenario();
    const deadline = clock.now() + 30 * minuteMs;
    const never: LifecycleDeps = {
      ...deps(),
      schedule: longSchedule(deadline),
      produceResult: () => Promise.resolve(null),
    };
    await expect(run(never)).rejects.toThrow("Too close to submitResultTime");
    expect(world.calls.submit).toBe(0);
  });

  it("adopts the saved bytes when an asynchronous result changes after a crash", async () => {
    const { clock, world, directory, deps, run } = await scenario();
    let produced = 0;
    const producing = (base: LifecycleDeps): LifecycleDeps => ({
      ...base,
      produceResult: () => {
        produced += 1;
        return Promise.resolve(produced === 1 ? "Receipt bytes one." : "Receipt bytes two.");
      },
    });
    const first = producing(deps());
    const crashing: LifecycleDeps = {
      ...first,
      journal: {
        ...first.journal,
        saveResult: async (taskId, text) => {
          await first.journal.saveResult(taskId, text);
          clock.killWhen = () => true;
          throw new Error("process died after writing the result file");
        },
      },
    };
    await expect(run(crashing)).rejects.toThrow(ProcessKilled);

    clock.killWhen = () => false;
    const verified = await run(producing(deps()));
    expect(produced).toBe(1);
    expect(verified.result.text).toBe("Receipt bytes one.");
    expect(verified.result.hash).toBe(sokosumiResultHash("Receipt bytes one.", verified.nonce));
    expect(await readFile(join(directory, `${world.taskId}.result.txt`), "utf8")).toBe(
      "Receipt bytes one.",
    );
    expect(world.submitted?.hash).toBe(verified.result.hash);
  });
});

describe("a rejected write keeps its cause", () => {
  it("lets a caller recognise a grant request behind the terminal error", async () => {
    const { run, deps } = await scenario();
    const base = deps();
    const blocked: LifecycleDeps = {
      ...base,
      core: {
        ...base.core,
        postEvent: () =>
          Promise.reject(new HttpStatusError("Sokosumi Core", 403, "Forbidden", "grant_required")),
      },
    };
    const failure = run(blocked);
    await expect(failure).rejects.toBeInstanceOf(TerminalLifecycleError);
    await expect(failure).rejects.toMatchObject({
      cause: { status: 403, kind: "grant_required" },
    });
    await expect(failure).rejects.toThrow("Personal Workspace notifications");
  });
});
