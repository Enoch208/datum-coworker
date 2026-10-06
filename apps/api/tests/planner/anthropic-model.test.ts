import { describe, expect, it } from "vitest";
import { createAnthropicPlannerModel, plannerModelId } from "../../src/planner/model";
import { plannerFixture } from "./fixture-model";

interface SentRequest {
  readonly url: string;
  readonly headers: Headers;
  readonly body: unknown;
}

const prompt = { system: "rules", user: "Plan this campaign." };

const apiMessage = (overrides: Record<string, unknown>) => ({
  id: "msg_fixture",
  type: "message",
  role: "assistant",
  model: plannerModelId,
  content: [{ type: "text", text: JSON.stringify(plannerFixture("plan-accepted")) }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
  ...overrides,
});

function fakeApi(status: number, body: unknown) {
  const sent: SentRequest[] = [];
  const fetchFake: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const text = await request.text();
    const parsed: unknown = JSON.parse(text);
    sent.push({ url: request.url, headers: request.headers, body: parsed });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  const model = createAnthropicPlannerModel({ apiKey: "test-key", fetch: fetchFake });
  return { model, sent };
}

describe("the Anthropic planner model", () => {
  it("asks the pinned model for schema-shaped JSON with server-side fallback", async () => {
    const { model, sent } = fakeApi(200, apiMessage({}));
    await expect(model.propose(prompt)).resolves.toEqual({
      model: plannerModelId,
      output: plannerFixture("plan-accepted"),
    });
    const [request] = sent;
    expect(request?.url).toMatch(/\/v1\/messages\?beta=true$/);
    expect(request?.headers.get("anthropic-beta")).toBe("server-side-fallback-2026-07-01");
    expect(request?.body).toMatchObject({
      model: "claude-sonnet-5-5",
      fallbacks: "default",
      system: "rules",
      messages: [{ role: "user", content: "Plan this campaign." }],
      output_config: { effort: "medium", format: { type: "json_schema" } },
    });
  });

  it("records the model that actually answered", async () => {
    const { model } = fakeApi(200, apiMessage({ model: "claude-sonnet-5" }));
    await expect(model.propose(prompt)).resolves.toMatchObject({ model: "claude-sonnet-5" });
  });

  it.each([
    ["a refusal", apiMessage({ stop_reason: "refusal", content: [] }), "REFUSED"],
    ["a truncated plan", apiMessage({ stop_reason: "max_tokens" }), "TRUNCATED"],
    ["no text", apiMessage({ content: [] }), "NO_OUTPUT"],
    [
      "text that is not JSON",
      apiMessage({ content: [{ type: "text", text: "Sure!" }] }),
      "NO_OUTPUT",
    ],
  ])("turns %s into a typed failure", async (_label, body, code) => {
    const { model } = fakeApi(200, body);
    await expect(model.propose(prompt)).rejects.toMatchObject({ code });
  });

  it("turns an API error into a typed failure", async () => {
    const { model, sent } = fakeApi(400, {
      type: "error",
      error: { type: "invalid_request_error", message: "bad request" },
    });
    await expect(model.propose(prompt)).rejects.toMatchObject({ code: "API_ERROR" });
    expect(sent).toHaveLength(1);
  });
});
