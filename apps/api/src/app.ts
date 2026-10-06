import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { ApiDeps } from "./deps";
import { errorBody, HttpError } from "./http/errors";
import { agentRoutes } from "./routes/agent";
import { assetRoutes } from "./routes/assets";
import { campaignRoutes } from "./routes/campaigns";
import { scanRoutes } from "./routes/scans";

export function createApp(deps: ApiDeps) {
  return new Hono()
    .get("/health", async (c) => {
      await deps.db.execute(sql`select 1`);
      return c.json({ status: "ok" });
    })
    .route("/", campaignRoutes(deps))
    .route("/", assetRoutes(deps))
    .route("/", scanRoutes(deps.db))
    .route("/", agentRoutes())
    .notFound((c) =>
      c.json(errorBody("NOT_FOUND", `No route for ${c.req.method} ${c.req.path}`), 404),
    )
    .onError((error, c) => {
      if (error instanceof HttpError) {
        return c.json(error.toBody(), error.status);
      }
      process.stderr.write(`${error.stack ?? error.message}\n`);
      return c.json(errorBody("INTERNAL", "Internal server error"), 500);
    });
}
