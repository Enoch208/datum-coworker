import { Hono } from "hono";
import { errorBody } from "../http/errors";

const hiringPath =
  "Datum is hired and paid as a Sokosumi Coworker: a buyer assigns it a Task, Datum attaches signed Masumi payment terms, works only after the escrow is confirmed, and is paid when the Masumi Payment Service collects for the seller.";

export const agentInputSchema = {
  input_data: [
    {
      id: "brief",
      type: "string",
      name: "Campaign brief",
      data: {
        description:
          "What to promote, where it should appear, the deadline and the budget. Datum reads this from the Sokosumi Task description.",
      },
      validations: [
        { validation: "min", value: "1" },
        { validation: "max", value: "16000" },
      ],
    },
  ],
} as const;

export function agentRoutes() {
  return new Hono()
    .get("/availability", (c) =>
      c.json({
        status: "unavailable",
        type: "masumi-agent",
        message: `This endpoint does not sell MIP-003 jobs. ${hiringPath}`,
      }),
    )
    .get("/input_schema", (c) => c.json(agentInputSchema))
    .post("/start_job", (c) =>
      c.json(
        errorBody(
          "START_JOB_UNSUPPORTED",
          `No job was created and no payment terms were issued. ${hiringPath}`,
        ),
        503,
      ),
    )
    .get("/status", (c) => {
      const jobId = c.req.query("job_id");
      if (jobId === undefined || jobId.length === 0) {
        return c.json(errorBody("VALIDATION_FAILED", "job_id is required"), 400);
      }
      return c.json(
        errorBody("NOT_FOUND", `Job ${jobId} does not exist: this endpoint never creates jobs`),
        404,
      );
    });
}
