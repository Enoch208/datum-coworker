import { cardanoNetwork } from "../constants";
import type { MpsApiKey } from "./schemas";

export function runtimeKeyProblems(key: MpsApiKey, sellingWalletId: string): string[] {
  const checks: [boolean, string][] = [
    [key.status === "Active", "key must be Active"],
    [key.canRead, "key must be able to read"],
    [key.canPay, "key must be able to pay"],
    [!key.canAdmin, "key must not be an admin key"],
    [!key.usageLimited, "key must not be usage limited (PATCH it with usageLimited:false)"],
    [
      key.NetworkLimit.length === 1 && key.NetworkLimit[0] === cardanoNetwork,
      "key must be Preprod only",
    ],
    [key.walletScopeEnabled, "key must have wallet scope enabled"],
    [
      key.WalletScopes.length === 1 && key.WalletScopes[0]?.hotWalletId === sellingWalletId,
      "key must be scoped to the selling wallet only",
    ],
  ];
  return checks.filter(([holds]) => !holds).map(([, problem]) => problem);
}
