import { join } from "node:path";
import { z } from "zod";
import { readIfExists, writePrivateFile } from "../files";
import { parseShape } from "../parse";

export const setupStateSchema = z.object({
  sellingWalletId: z.string(),
  sellerAddress: z.string(),
  sellerVkey: z.string(),
  smartContractAddress: z.string(),
  registryPolicyId: z.string().nullable(),
  apiBaseUrl: z.string(),
  registrationRequestedAt: z.string().nullable(),
  registrationId: z.string().nullable(),
  registrationState: z.string().nullable(),
  registrationTxHash: z.string().nullable(),
  agentIdentifier: z.string().nullable(),
  supportedPaymentSourceIndex: z.number().int().nullable(),
  apiKeyRequestedAt: z.string().nullable(),
  apiKeyId: z.string().nullable(),
});
export type SetupState = z.infer<typeof setupStateSchema>;

export interface SetupFiles {
  readonly statePath: string;
  readonly runtimeEnvPath: string;
  load(): Promise<SetupState | null>;
  save(state: SetupState): Promise<void>;
  saveRuntimeToken(token: string): Promise<void>;
  hasRuntimeToken(): Promise<boolean>;
}

export function setupFiles(directory: string): SetupFiles {
  const statePath = join(directory, "registration.json");
  const runtimeEnvPath = join(directory, "mps-runtime.env");
  return {
    statePath,
    runtimeEnvPath,
    async load() {
      const raw = await readIfExists(statePath);
      return raw === null ? null : parseShape(statePath, setupStateSchema, JSON.parse(raw));
    },
    save: (state) => writePrivateFile(directory, statePath, JSON.stringify(state, null, 2)),
    saveRuntimeToken: (token) =>
      writePrivateFile(directory, runtimeEnvPath, `MASUMI_PAYMENT_API_KEY=${token}\n`),
    hasRuntimeToken: async () =>
      (await readIfExists(runtimeEnvPath))?.startsWith("MASUMI_PAYMENT_API_KEY=") ?? false,
  };
}
