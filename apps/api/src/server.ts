import { serve } from "@hono/node-server";
import { createDb } from "@datum/db";
import { createApp } from "./app";
import { loadEnv } from "./env";

const env = loadEnv(process.env);
const app = createApp({ db: createDb(env.DATABASE_URL), appBaseUrl: env.APP_BASE_URL });

serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST }, (info) => {
  process.stdout.write(`Datum API listening on http://${env.HOST}:${String(info.port)}\n`);
});
