import { describe, expect, it } from "vitest";
import type { FetchLike } from "../src/http";
import { createCoreClient } from "../src/sokosumi/client";
import recordedPage from "./fixtures/task-list-completed.json";

const baseUrl = "https://api.preprod.sokosumi.com";
const apiKey = "coworker_test_runtime_key";

function pages(bodies: readonly unknown[]) {
  const urls: string[] = [];
  const headers: Record<string, string>[] = [];
  const fetch: FetchLike = (url, init) => {
    urls.push(url);
    headers.push(init.headers as Record<string, string>);
    const body = bodies[urls.length - 1];
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  };
  return { fetch, urls, headers };
}

const [recordedTask] = recordedPage.data;
if (recordedTask === undefined) throw new Error("the recorded page lost its Task");

const pageOf = (ids: readonly string[], nextCursor: string | null) => ({
  data: ids.map((id) => ({ ...recordedTask, id, status: "READY" })),
  meta: { timestamp: "t", requestId: "r", pagination: { cursor: null, limit: 100, nextCursor } },
});

describe("Sokosumi Core Task listing", () => {
  it("parses the recorded live list page without a context header", async () => {
    const { fetch, urls, headers } = pages([recordedPage]);
    const core = createCoreClient({ baseUrl, apiKey, fetch });
    const tasks = await core.listTasks(["COMPLETED"]);
    expect(tasks).toEqual([
      expect.objectContaining({
        id: "01a1106d-fd53-74ce-bedd-07fbd75d136c",
        status: "COMPLETED",
        organizationId: null,
        workspace: expect.objectContaining({ organizationId: null }) as unknown,
      }),
    ]);
    expect(urls).toEqual([`${baseUrl}/v1/tasks?status=COMPLETED&limit=100`]);
    expect(headers[0]).toMatchObject({ authorization: `Bearer ${apiKey}` });
    expect(headers[0]).not.toHaveProperty("x-context-user-id");
  });

  it("follows the cursor across pages so a busy Coworker never misses a READY Task", async () => {
    const { fetch, urls } = pages([pageOf(["t1", "t2"], "t2"), pageOf(["t3"], null)]);
    const core = createCoreClient({ baseUrl, apiKey, fetch });
    const tasks = await core.listTasks(["READY", "INPUT_REQUIRED"]);
    expect(tasks.map((task) => task.id)).toEqual(["t1", "t2", "t3"]);
    expect(urls).toEqual([
      `${baseUrl}/v1/tasks?status=READY%2CINPUT_REQUIRED&limit=100`,
      `${baseUrl}/v1/tasks?status=READY%2CINPUT_REQUIRED&limit=100&cursor=t2`,
    ]);
  });

  it("refuses a page whose Tasks break the schema", async () => {
    const broken = { ...pageOf(["t1"], null), data: [{ id: "t1" }] };
    const core = createCoreClient({ baseUrl, apiKey, fetch: pages([broken]).fetch });
    await expect(core.listTasks(["READY"])).rejects.toThrow("unexpected shape");
  });
});
