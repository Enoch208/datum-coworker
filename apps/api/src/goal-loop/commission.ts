import type { PhysicalTaskDraft } from "@datum/core";
import { NoRunnerAvailableError } from "../executor/local-dispatch";
import type { LoopDeps } from "./deps";
import { recordUnlessRepeated } from "./once";

export async function commissionTask(deps: LoopDeps, draft: PhysicalTaskDraft): Promise<boolean> {
  try {
    await deps.executor.createTask(draft);
    return true;
  } catch (error) {
    if (!(error instanceof NoRunnerAvailableError)) throw error;
    await recordUnlessRepeated(deps.db, draft.campaignId, {
      type: "RUNNER_UNAVAILABLE",
      payload: {
        kind: "NONE_AVAILABLE",
        idempotencyKey: draft.idempotencyKey,
        type: draft.type,
        spotCode: draft.spotCode,
        attempt: draft.attempt,
        dueBy: draft.dueBy,
      },
    });
    return false;
  }
}
