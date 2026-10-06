import { z } from "zod";
import { sokosumiPreprodApiUrl } from "../constants";
import { defaultDatumDir, httpUrl } from "../env";

export const gate0EnvSchema = z.object({
  SOKOSUMI_COWORKER_API_KEY: z.string().regex(/^coworker_\S+$/, "must be a coworker_ runtime key"),
  SOKOSUMI_API_URL: z
    .url({ protocol: /^https$/ })
    .transform((url) => url.replace(/\/+$/, ""))
    .default(sokosumiPreprodApiUrl),
  MASUMI_PAYMENT_API_URL: httpUrl,
  MASUMI_PAYMENT_API_KEY: z.string().min(15, "must be the scoped ReadAndPay MPS token"),
  MASUMI_AGENT_IDENTIFIER: z
    .string()
    .regex(/^[0-9a-f]{57,250}$/, "must be the registered agentIdentifier (lowercase hex)"),
  MASUMI_SUPPORTED_PAYMENT_SOURCE_INDEX: z.coerce.number().int().min(0).max(24),
  MASUMI_SELLER_ADDRESS: z.string().regex(/^addr_test1[0-9a-z]+$/, "must be a Preprod address"),
  BLOCKFROST_API_KEY_PREPROD: z.string().regex(/^preprod[A-Za-z0-9]+$/, "must be a Preprod key"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  MASUMI_JOURNAL_DIR: z.string().min(1).default(defaultDatumDir("masumi-journal")),
});

export type Gate0Env = z.infer<typeof gate0EnvSchema>;
