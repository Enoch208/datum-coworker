import type { LifecycleDeps } from "../../src/lifecycle/deps";
import { runLifecycle } from "../../src/lifecycle/machine";
import { FakeClock } from "./clock";
import { MemoryEvidence, journalDirectory, lifecycleDeps } from "./fakes";
import { World } from "./world";

const options = { pollMs: 10_000, maxConsecutiveFailures: 5 };

export async function scenario() {
  const clock = new FakeClock(Date.parse("2026-10-06T02:20:00.000Z"));
  const world = new World(clock);
  const directory = await journalDirectory();
  const evidence = new MemoryEvidence();
  const lines: string[] = [];
  const deps = (): LifecycleDeps => lifecycleDeps(world, directory, evidence, lines);
  const run = (dependencies: LifecycleDeps = deps()) =>
    runLifecycle(world.taskId, dependencies, options);
  return { clock, world, directory, evidence, lines, deps, run };
}
