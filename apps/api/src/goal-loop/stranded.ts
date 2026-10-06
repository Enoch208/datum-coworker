import type { LoopDeps } from "./deps";
import { closeDeliveredTasks, hasProof, openTasks, runnerGone } from "./delivered";
import { recordUnlessRepeated } from "./once";

export async function releaseStrandedTasks(
  deps: LoopDeps,
  campaignId: string,
  now: Date,
  signal: AbortSignal,
): Promise<void> {
  const gone = runnerGone(now);
  await closeDeliveredTasks(deps.db, campaignId, now, gone);
  for (const open of (await openTasks(deps.db, campaignId)).filter(gone)) {
    if (await hasProof(deps.db, open.task)) continue;
    signal.throwIfAborted();
    await recordUnlessRepeated(deps.db, campaignId, {
      type: "RUNNER_UNAVAILABLE",
      payload: {
        kind: "LINK_CLOSED",
        taskId: open.task.id,
        type: open.task.type,
        spotCode: open.spotCode,
        attempt: open.task.attempt,
        runnerName: open.runner?.name ?? "The assigned runner",
      },
    });
    await deps.executor.cancelTask({ adapter: open.task.adapter, externalRef: open.task.id });
  }
}
