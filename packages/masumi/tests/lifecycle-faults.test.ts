import { describe, expect, it } from "vitest";
import { minuteMs, tusdmUnit } from "../src/constants";
import { TerminalLifecycleError } from "../src/errors";
import collection from "./fixtures/collection-tx-3837cb22.json";
import { recordedSeller } from "./fixtures/mps-payment";
import { ProcessKilled } from "./support/clock";
import { worldChain } from "./support/fakes";
import { scenario } from "./support/scenario";

describe("payment attach faults", () => {
  it("inspects a 409 and adopts the payment Core already holds", async () => {
    const { world, run } = await scenario();
    world.faults.set("attach", "conflict");
    await expect(run()).resolves.toMatchObject({ step: "verified", paymentEventId: null });
    expect(world.calls.attach).toBe(1);
  });

  it("stops on a 409 when Core holds no payment, without retrying", async () => {
    const { world, run } = await scenario();
    world.faults.set("attach", "phantom-conflict");
    await expect(run()).rejects.toThrow("holds no payment");
    expect(world.calls.attach).toBe(1);
    expect(world.calls.submit).toBe(0);
  });

  it("stops when Core pauses the Task for missing credits", async () => {
    const { world, evidence, run } = await scenario();
    world.faults.set("attach", "insufficient-balance");
    await expect(run()).rejects.toThrow(/OUT_OF_CREDITS/);
    expect(world.calls.attach).toBe(1);
    expect(evidence.rows.size).toBe(0);
  });

  it("renews terms that were never attached and are about to expire", async () => {
    const { clock, world, run } = await scenario();
    world.faults.set("attach", "dropped");
    clock.killWhen = () => world.calls.attach > 0;
    await expect(run()).rejects.toThrow(ProcessKilled);
    clock.advance(8 * minuteMs);

    clock.killWhen = () => false;
    await expect(run()).resolves.toMatchObject({ step: "verified" });
    expect(world.calls.terms).toBe(2);
    expect(world.calls.attach).toBe(2);
    expect(world.attached?.blockchainIdentifier).toMatch(/0002$/);
  });
});

describe("completion reconciliation", () => {
  const killAfterCompletion = async () => {
    const setup = await scenario();
    setup.world.faults.set("complete", "lost-response");
    setup.clock.killWhen = () => setup.world.calls.complete > 0;
    await expect(setup.run()).rejects.toThrow(ProcessKilled);
    setup.clock.killWhen = () => false;
    return setup;
  };
  const journaledStep = async ({ deps, world }: Awaited<ReturnType<typeof scenario>>) =>
    (await deps().journal.load(world.taskId))?.step;

  it("adopts a lost completion whose stored comment is the hashed result", async () => {
    const setup = await killAfterCompletion();
    expect(await journaledStep(setup)).toBe("result_confirmed");
    await expect(setup.run()).resolves.toMatchObject({ step: "verified" });
    expect(setup.world.calls.complete).toBe(1);
  });

  it("stops on a lost completion whose stored comment differs from the hashed result", async () => {
    const setup = await scenario();
    setup.world.storeComment = (comment) => `${comment} `;
    setup.world.faults.set("complete", "lost-response");
    setup.clock.killWhen = () => setup.world.calls.complete > 0;
    await expect(setup.run()).rejects.toThrow(ProcessKilled);
    setup.clock.killWhen = () => false;

    const restarted = setup.run();
    await expect(restarted).rejects.toThrow(TerminalLifecycleError);
    await expect(restarted).rejects.toThrow("different result than the one hashed on chain");
    expect(await journaledStep(setup)).toBe("result_confirmed");
    expect(setup.world.calls.complete).toBe(1);
    expect(setup.evidence.rows.get(setup.world.taskId)?.collectionConfirmed).toBe(false);
  });

  it("stops when Core answers the completion with a different comment", async () => {
    const setup = await scenario();
    setup.world.storeComment = (comment) => comment.toUpperCase();
    await expect(setup.run()).rejects.toThrow("different result than the one hashed on chain");
    expect(await journaledStep(setup)).toBe("result_confirmed");
  });
});

describe("deadline and settlement faults", () => {
  it("gives up when escrow locks too late to submit the result", async () => {
    const { world, evidence, run } = await scenario();
    world.escrowDelayMs = 16 * minuteMs;
    await expect(run()).rejects.toThrow("Escrow did not lock in time");
    expect(world.calls.submit).toBe(0);
    expect(evidence.rows.size).toBe(0);
  });

  it("reports an overdue collection instead of waiting forever", async () => {
    const { world, evidence, run } = await scenario();
    world.collectionLagMs = 60 * minuteMs;
    await expect(run()).rejects.toThrow(/AUTO_WITHDRAW_PAYMENTS/);
    expect(evidence.rows.get(world.taskId)?.collectionConfirmed).toBe(false);
  });

  it("never confirms collection when the chain shows a smaller seller net", async () => {
    const { world, evidence, deps, run } = await scenario();
    const shortChanged = structuredClone(collection.utxos);
    const sellerOutput = shortChanged.outputs[0]?.amount.find(
      (amount) => amount.unit === tusdmUnit,
    );
    if (sellerOutput === undefined) {
      throw new Error("fixture lost its seller output");
    }
    sellerOutput.quantity = "999999";
    const failure = run({ ...deps(), chain: worldChain(world, shortChanged) });
    await expect(failure).rejects.toThrow(TerminalLifecycleError);
    await expect(failure).rejects.toThrow("Seller net on chain is 999999");
    expect(evidence.rows.get(world.taskId)).toMatchObject({
      sellerAddress: recordedSeller.sellerAddress,
      collectionConfirmed: false,
      netReceivedAtomic: null,
    });
  });

  it("treats a stuck read as transient until the failure budget runs out", async () => {
    const { world, deps, run } = await scenario();
    const flaky = deps();
    const failing = {
      ...flaky,
      core: { ...flaky.core, me: () => Promise.reject(new Error("socket hang up")) },
    };
    await expect(run(failing)).rejects.toThrow("kept failing: socket hang up");
    expect(world.calls.start).toBe(0);
  });
});
