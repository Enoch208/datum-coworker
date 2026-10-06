import type { MpsClient } from "../mps/client";
import { runtimeKeyProblems } from "../mps/key-scope";
import type { CoreClient } from "../sokosumi/client";

export async function preflight(
  core: Pick<CoreClient, "me">,
  mps: Pick<MpsClient, "health" | "apiKeyStatus">,
  sellingWalletId: string,
  log: (line: string) => void,
): Promise<string> {
  const health = await mps.health();
  if (health.status !== "ok") {
    throw new Error(`Masumi Payment Service health is ${health.status}`);
  }
  const key = await mps.apiKeyStatus();
  const problems = runtimeKeyProblems(key, sellingWalletId);
  if (problems.length > 0) {
    throw new Error(`MASUMI_PAYMENT_API_KEY is not the scoped runtime key: ${problems.join("; ")}`);
  }
  const coworker = await core.me();
  if (coworker.archivedAt !== null || !coworker.capabilities.includes("tasks")) {
    throw new Error("SOKOSUMI_COWORKER_API_KEY does not belong to an active Task Coworker");
  }
  log(
    `MPS healthy; runtime key ${key.id} is ${key.permission} on Preprod, scoped to selling wallet ${sellingWalletId}; Coworker ${coworker.id} ready`,
  );
  return coworker.id;
}
