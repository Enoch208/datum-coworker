import { Hono, type Context } from "hono";
import type { RunnerRow } from "@datum/db";
import type { ApiDeps } from "../deps";
import { submitEvidence } from "../evidence/submit";
import { runnerForToken } from "../runners/enrollment";
import { runnerInbox, runnerTaskView } from "../runners/inbox";
import { acceptTask, completeTask } from "../runners/progress";
import { fileField, readForm, uploadBodyLimit } from "../uploads/form";

const taskPath = "/runner/:token/tasks/:taskId";

export function runnerRoutes(deps: ApiDeps) {
  const { db, appBaseUrl } = deps;
  const runnerOf = (c: Context): Promise<RunnerRow> =>
    runnerForToken(db, c.req.param("token") ?? "");
  const taskIdOf = (c: Context): string => c.req.param("taskId") ?? "";
  const noStore = (c: Context) => {
    c.header("cache-control", "no-store");
  };
  return new Hono()
    .get("/runner/:token", async (c) => {
      const runner = await runnerOf(c);
      noStore(c);
      return c.json(await runnerInbox(db, appBaseUrl, runner));
    })
    .post(`${taskPath}/accept`, async (c) => {
      const runner = await runnerOf(c);
      await acceptTask(db, runner, taskIdOf(c));
      noStore(c);
      return c.json(await runnerTaskView(db, appBaseUrl, runner, taskIdOf(c)));
    })
    .post(`${taskPath}/evidence`, uploadBodyLimit, async (c) => {
      const runner = await runnerOf(c);
      const photo = await fileField(await readForm(c), "photo");
      const submitted = await submitEvidence(deps, runner, taskIdOf(c), photo);
      noStore(c);
      return c.json(submitted.view, submitted.created ? 201 : 200);
    })
    .post(`${taskPath}/complete`, async (c) => {
      const runner = await runnerOf(c);
      await completeTask(db, runner, taskIdOf(c));
      noStore(c);
      return c.json(await runnerTaskView(db, appBaseUrl, runner, taskIdOf(c)));
    });
}
