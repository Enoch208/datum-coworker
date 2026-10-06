import type { MpsClient } from "../mps/client";
import type { CoreClient } from "../sokosumi/client";

export async function preflight(
  core: Pick<CoreClient, "me">,
  mps: Pick<MpsClient, "health" | "apiKeyStatus">,
  log: (line: string) => void,
): Promise<string> {
  const health = await mps.health();
  if (health.status !== "ok") {
    throw new Error(`Masumi Payment Service health is ${health.status}`);
  }
  const key = await mps.apiKeyStatus();
  const scoped = key.status === "Active" && key.canPay && !key.canAdmin;
  if (!scoped || !key.NetworkLimit.includes("Preprod")) {
    throw new Error(
      "MASUMI_PAYMENT_API_KEY must be an active, non-admin ReadAndPay key for Preprod",
    );
  }
  const coworker = await core.me();
  if (coworker.archivedAt !== null || !coworker.capabilities.includes("tasks")) {
    throw new Error("SOKOSUMI_COWORKER_API_KEY does not belong to an active Task Coworker");
  }
  log(`MPS healthy; runtime key ${key.id} is ${key.permission}; Coworker ${coworker.id} ready`);
  return coworker.id;
}
