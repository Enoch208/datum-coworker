import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { minuteMs } from "../src/constants";
import { isAsciiSafeResult, sokosumiResultHash } from "../src/hash";
import type { LifecycleDeps } from "../src/lifecycle/deps";
import { recordedSeller, recordedTxs } from "./fixtures/mps-payment";
import { ProcessKilled } from "./support/clock";
import { scenario } from "./support/scenario";
import type { World } from "./support/world";

describe("paid Task lifecycle", () => {
  it("takes a READY Task through to a verified seller collection", async () => {
    const { world, directory, evidence, lines, run } = await scenario();
    const verified = await run();

    expect(world.calls).toEqual({ start: 1, terms: 1, attach: 1, submit: 1, complete: 1 });
    expect(verified.step).toBe("verified");
    expect(verified.proof).toMatchObject({
      txHash: recordedTxs.collection,
      netReceivedAtomic: "1000000",
      receiptOnChainState: "Withdrawn",
    });

    const saved = await readFile(join(directory, `${world.taskId}.result.txt`), "utf8");
    expect(saved).toBe(verified.result.text);
    expect(isAsciiSafeResult(saved)).toBe(true);
    expect(verified.result.hash).toBe(sokosumiResultHash(saved, verified.nonce));
    expect(world.submitted?.hash).toBe(verified.result.hash);
    expect(world.events.at(-1)).toMatchObject({ status: "COMPLETED", comment: saved });

    expect(evidence.rows.get(world.taskId)).toMatchObject({
      paymentId: verified.terms.paymentId,
      blockchainIdentifier: verified.terms.blockchainIdentifier,
      resultHash: verified.result.hash,
      sellerAddress: recordedSeller.sellerAddress,
      collectionTxHash: recordedTxs.collection,
      netReceivedAtomic: "1000000",
      collectionConfirmed: true,
    });
    expect(lines.some((line) => line.startsWith("Core receipt not settled yet"))).toBe(true);
  });

  it("writes every intent to the journal before its side effect", async () => {
    const { directory, world, run } = await scenario();
    await run();
    const journal = JSON.parse(await readFile(join(directory, `${world.taskId}.json`), "utf8")) as {
      history: { event: string }[];
    };
    const events = journal.history.map((entry) => entry.event);
    const order = (event: string) => events.indexOf(event);
    for (const [intent, step] of [
      ["intent:start_task", "step:started"],
      ["intent:request_terms", "step:terms_requested"],
      ["intent:attach_payment", "step:payment_attached"],
      ["intent:submit_result", "step:result_submitted"],
      ["intent:complete_task", "step:task_completed"],
    ] as const) {
      expect(order(intent)).toBeGreaterThan(-1);
      expect(order(intent)).toBeLessThan(order(step));
    }
    expect(order("step:funds_locked")).toBeLessThan(order("step:result_saved"));
    expect(order("step:result_confirmed")).toBeLessThan(order("intent:complete_task"));
    expect((await stat(join(directory, `${world.taskId}.json`))).mode & 0o777).toBe(0o600);
  });

  it("does the work only after escrow and completes only after ResultSubmitted confirms", async () => {
    const { world, run } = await scenario();
    const verified = await run();
    const completedAt = Date.parse(world.events.at(-1)?.createdAt ?? "");
    const escrowAt = world.escrowAt() ?? Infinity;
    expect(world.submitted?.at).toBeGreaterThanOrEqual(escrowAt);
    expect(completedAt).toBeGreaterThanOrEqual(world.resultAt() ?? Infinity);
    expect(Number(verified.terms.submitResultTime) - (world.submitted?.at ?? 0)).toBeGreaterThan(
      6 * minuteMs,
    );
  });

  it("refuses to take a second worker on the same Task", async () => {
    const { deps, world } = await scenario();
    const release = await deps().journal.lock(world.taskId);
    await expect(deps().journal.lock(world.taskId)).rejects.toThrow("already being worked");
    await release();
    await expect(deps().journal.lock(world.taskId)).resolves.toBeTypeOf("function");
  });
});

describe("restart after a kill", () => {
  it.each([
    ["attach", (world: World) => world.calls.attach > 0],
    ["submit", (world: World) => world.calls.submit > 0],
    ["complete", (world: World) => world.calls.complete > 0],
    ["start", (world: World) => world.calls.start > 0],
  ] as const)(
    "reconciles a %s whose response was lost instead of repeating it",
    async (point, killed) => {
      const { clock, world, run } = await scenario();
      world.faults.set(point, "lost-response");
      clock.killWhen = () => killed(world);
      await expect(run()).rejects.toThrow(ProcessKilled);

      clock.killWhen = () => false;
      const verified = await run();
      expect(verified.step).toBe("verified");
      expect(world.calls).toEqual({ start: 1, terms: 1, attach: 1, submit: 1, complete: 1 });
    },
  );

  it("resumes the collection wait without writing anything twice", async () => {
    const { clock, world, evidence, run } = await scenario();
    clock.killWhen = () => world.taskStatus === "COMPLETED";
    await expect(run()).rejects.toThrow(ProcessKilled);
    expect(evidence.rows.get(world.taskId)?.collectionConfirmed).toBe(false);

    clock.killWhen = () => false;
    await run();
    expect(world.calls).toEqual({ start: 1, terms: 1, attach: 1, submit: 1, complete: 1 });
    expect(evidence.rows.get(world.taskId)?.collectionConfirmed).toBe(true);
  });

  it("adopts the saved result bytes after a crash between the file write and result_saved", async () => {
    const { clock, world, directory, deps, run } = await scenario();
    const firstText = "Datum result from the first process.";
    let produced = 0;
    const producing = (base: LifecycleDeps): LifecycleDeps => ({
      ...base,
      produceResult: () => {
        produced += 1;
        return produced === 1 ? firstText : "Datum result from a second, different run.";
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
    expect((await first.journal.load(world.taskId))?.step).toBe("funds_locked");
    expect(produced).toBe(1);

    clock.killWhen = () => false;
    const verified = await run(producing(deps()));
    expect(produced).toBe(1);
    expect(verified.result.text).toBe(firstText);
    expect(verified.result.hash).toBe(sokosumiResultHash(firstText, verified.nonce));
    expect(await readFile(join(directory, `${world.taskId}.result.txt`), "utf8")).toBe(firstText);
    expect(world.submitted?.hash).toBe(verified.result.hash);
  });

  it("never requests new terms once terms are attached", async () => {
    const { clock, world, run } = await scenario();
    world.faults.set("attach", "lost-response");
    clock.killWhen = () => world.calls.attach > 0;
    await expect(run()).rejects.toThrow(ProcessKilled);
    clock.advance(9 * minuteMs);

    clock.killWhen = () => false;
    await run();
    expect(world.calls.terms).toBe(1);
    expect(world.calls.attach).toBe(1);
  });
});
