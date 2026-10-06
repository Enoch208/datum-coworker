import { Hono } from "hono";
import type { ApiDeps } from "../deps";
import { pathId, readBody } from "../http/input";
import { requireOperator } from "../http/operator";
import { enrollRunnerSchema } from "../http/operator-schemas";
import { deactivateRunner, enrollRunner, listRunners } from "../runners/enrollment";

export function operatorRoutes(deps: ApiDeps) {
  return new Hono()
    .use("/operator/*", requireOperator(deps.operatorKey))
    .post("/operator/runners", async (c) => {
      const input = await readBody(c, enrollRunnerSchema);
      return c.json(await enrollRunner(deps.db, deps.appBaseUrl, input), 201);
    })
    .get("/operator/runners", async (c) => c.json(await listRunners(deps.db)))
    .post("/operator/runners/:id/deactivate", async (c) =>
      c.json(await deactivateRunner(deps.db, pathId(c, "id", "rnr", "Runner"))),
    );
}
