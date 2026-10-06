import { afterAll, describe, expect, it } from "vitest";
import { agentInputSchema } from "../src/routes/agent";
import { call, db } from "./support";

afterAll(async () => {
  await db.$client.end();
});

describe("MIP-003 agent endpoint", () => {
  it("says it is unavailable for MIP-003 jobs and how Datum is actually hired", async () => {
    const reply = await call<{ status: string; type: string; message: string }>(
      "GET",
      "/availability",
    );
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ status: "unavailable", type: "masumi-agent" });
    expect(reply.body.message).toContain("Sokosumi Coworker");
  });

  it("publishes a MIP-003 input schema with one string field", async () => {
    const reply = await call<typeof agentInputSchema>("GET", "/input_schema");
    expect(reply).toEqual({ status: 200, body: agentInputSchema });
    expect(reply.body.input_data.map((field) => [field.id, field.type])).toEqual([
      ["brief", "string"],
    ]);
  });

  it("refuses start_job without creating a job or payment terms", async () => {
    const reply = await call<{ error: string; message: string }>("POST", "/start_job", {
      identifier_from_purchaser: "0123456789abcdef0123",
      input_data: { brief: "Put up four posters" },
    });
    expect(reply.status).toBe(503);
    expect(reply.body.error).toBe("START_JOB_UNSUPPORTED");
    expect(reply.body.message).toContain("No job was created");
  });

  it("knows no job ids", async () => {
    expect(await call("GET", "/status?job_id=1ca41011-c197-40ff-be0c-9bfed3d82357")).toMatchObject({
      status: 404,
      body: { error: "NOT_FOUND" },
    });
    expect(await call("GET", "/status")).toMatchObject({
      status: 400,
      body: { error: "VALIDATION_FAILED" },
    });
  });
});
