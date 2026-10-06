import { z } from "zod";

const httpUrl = z.url({ protocol: /^https?$/ });

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  APP_BASE_URL: httpUrl.transform((url) => url.replace(/\/+$/, "")),
  PORT: z.coerce.number().int().positive().default(8790),
  HOST: z.string().min(1).default("127.0.0.1"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}
