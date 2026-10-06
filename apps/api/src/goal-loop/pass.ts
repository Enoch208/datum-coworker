import { loopCampaignIds, withCampaignLock } from "./claim";
import type { LoopDeps } from "./deps";
import { tickCampaign } from "./tick";

export interface TickFailure {
  readonly campaignId: string;
  readonly error: Error;
}

export interface PassReport {
  readonly ticked: string[];
  readonly skipped: string[];
  readonly failed: TickFailure[];
}

const asError = (thrown: unknown): Error =>
  thrown instanceof Error ? thrown : new Error(String(thrown));

export async function runLoopPass(deps: LoopDeps, signal: AbortSignal): Promise<PassReport> {
  const report: PassReport = { ticked: [], skipped: [], failed: [] };
  for (const campaignId of await loopCampaignIds(deps.db)) {
    signal.throwIfAborted();
    try {
      const run = await withCampaignLock(deps.db, campaignId, () =>
        tickCampaign(deps, campaignId, signal),
      );
      (run.acquired ? report.ticked : report.skipped).push(campaignId);
    } catch (thrown) {
      if (signal.aborted) throw thrown;
      report.failed.push({ campaignId, error: asError(thrown) });
    }
  }
  return report;
}
