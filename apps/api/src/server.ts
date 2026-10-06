import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { createDb } from "@datum/db";
import { createApp } from "./app";
import { brandPageLimits, createHtmlFetcher } from "./brand-page/safe-fetch";
import { createBrandPageReader } from "./brand-page/reader";
import { loadEnv, rateSettings } from "./env";
import { createAnthropicPlannerModel } from "./planner/model";

const env = loadEnv(process.env);
const app = createApp({
  db: createDb(env.DATABASE_URL),
  appBaseUrl: env.APP_BASE_URL,
  operatorKey: env.OPERATOR_KEY ?? null,
  assetDir: resolve(env.ASSET_DIR),
  planner:
    env.ANTHROPIC_API_KEY === undefined
      ? null
      : createAnthropicPlannerModel({ apiKey: env.ANTHROPIC_API_KEY }),
  rates: rateSettings(env),
  readBrandPage: createBrandPageReader(createHtmlFetcher(brandPageLimits)),
});

serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST }, (info) => {
  process.stdout.write(`Datum API listening on http://${env.HOST}:${String(info.port)}\n`);
});
