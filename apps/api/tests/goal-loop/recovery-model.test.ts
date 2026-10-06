import { describe, expect, it } from "vitest";
import { plannerModelId } from "../../src/planner/model";
import {
  checkedProposal,
  createAnthropicRecoveryPlanner,
} from "../../src/goal-loop/recovery-schema";

interface SentRequest {
  readonly url: string;
  readonly headers: Headers;
  readonly body: unknown;
}

const proposal = {
  actions: [{ spotCodes: ["C"], dueInMinutes: 30, runnerNote: "Keep the code in frame." }],
  rationale: "One short trip back to Spot C.",
};

const apiMessage = (overrides: Record<string, unknown>) => ({
  id: "msg_fixture",
  type: "message",
  role: "assistant",
  model: plannerModelId,
  content: [{ type: "text", text: JSON.stringify(proposal) }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
  ...overrides,
});

function fakeApi(status: number, body: unknown) {
  const sent: SentRequest[] = [];
  const fetchFake: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const parsed: unknown = JSON.parse(await request.text());
    sent.push({ url: request.url, headers: request.headers, body: parsed });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return { model: createAnthropicRecoveryPlanner({ apiKey: "test-key", fetch: fetchFake }), sent };
}

const prompt = { system: "rules", user: "Plan the recovery." };

describe("the Anthropic recovery planner", () => {
  it("asks the planner's pinned model for a schema-shaped recovery with no money in it", async () => {
    const { model, sent } = fakeApi(200, apiMessage({}));
    await expect(model.propose(prompt)).resolves.toEqual({
      model: plannerModelId,
      output: proposal,
    });
    const [request] = sent;
    expect(request?.headers.get("anthropic-beta")).toBe("server-side-fallback-2026-07-01");
    expect(request?.body).toMatchObject({
      model: plannerModelId,
      fallbacks: "default",
      output_config: { format: { type: "json_schema" } },
    });
    const schema = JSON.stringify(request?.body);
    expect(schema).toContain("dueInMinutes");
    expect(schema).not.toMatch(/cost|price|amount/i);
  });

  it("does not retry a failed call, so the loop falls back at once", async () => {
    const { model, sent } = fakeApi(529, {
      type: "error",
      error: { type: "overloaded_error", message: "overloaded" },
    });
    await expect(model.propose(prompt)).rejects.toMatchObject({ code: "API_ERROR" });
    expect(sent).toHaveLength(1);
  });

  it("turns a refusal into a typed failure", async () => {
    const { model } = fakeApi(200, apiMessage({ stop_reason: "refusal", content: [] }));
    await expect(model.propose(prompt)).rejects.toMatchObject({ code: "REFUSED" });
  });
});

describe("checkedProposal", () => {
  it("accepts a proposal and tidies its text", () => {
    const messy = { ...proposal, rationale: "  One short\ntrip.  " };
    expect(checkedProposal(messy)).toEqual({ ...proposal, rationale: "One short trip." });
  });

  it.each([
    ["an extra field", { ...proposal, budget: "SGD 5.00" }],
    [
      "a long runner note",
      { ...proposal, actions: [{ ...proposal.actions[0], runnerNote: "x".repeat(241) }] },
    ],
    [
      "no time for the runner",
      { ...proposal, actions: [{ ...proposal.actions[0], dueInMinutes: 0 }] },
    ],
    [
      "a fractional minute",
      { ...proposal, actions: [{ ...proposal.actions[0], dueInMinutes: 1.5 }] },
    ],
  ])("explains why it refuses %s", (_label, output) => {
    expect(typeof checkedProposal(output)).toBe("string");
  });
});
