import { describe, expect, it } from "vitest";
import {
  createAnthropicReceiptReader,
  receiptCallLimits,
  receiptModelId,
} from "../../src/receipts/reader";
import { receiptFixture } from "./fixture-reader";
import { receiptPhoto } from "./receipt-image";

interface SentRequest {
  readonly url: string;
  readonly headers: Headers;
  readonly body: unknown;
}

const apiMessage = (overrides: Record<string, unknown>) => ({
  id: "msg_fixture",
  type: "message",
  role: "assistant",
  model: receiptModelId,
  content: [{ type: "text", text: JSON.stringify(receiptFixture("receipt-print-hub")) }],
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
  return { reader: createAnthropicReceiptReader({ apiKey: "test-key", fetch: fetchFake }), sent };
}

interface Reply {
  readonly status: number;
  readonly body: unknown;
}

const overloaded: Reply = {
  status: 529,
  body: { type: "error", error: { type: "overloaded_error", message: "Overloaded" } },
};

function sequencedApi(replies: readonly Reply[]) {
  const sent: SentRequest[] = [];
  const fetchFake: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const parsed: unknown = JSON.parse(await request.text());
    sent.push({ url: request.url, headers: request.headers, body: parsed });
    const reply = replies[Math.min(sent.length, replies.length) - 1];
    if (reply === undefined) throw new Error("The fake API has no reply to give");
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { "content-type": "application/json", "retry-after-ms": "1" },
    });
  };
  return { reader: createAnthropicReceiptReader({ apiKey: "test-key", fetch: fetchFake }), sent };
}

const text = (value: string) => [{ type: "text", text: value }];

describe("the receipt reader's live path", () => {
  it("sends the receipt image and asks for schema-shaped JSON with server-side fallback", async () => {
    const { reader, sent } = fakeApi(200, apiMessage({}));
    const reply = await reader.read(await receiptPhoto({ merchant: "PRINT HUB", total: "13.80" }));
    expect(reply).toEqual({ model: receiptModelId, reading: receiptFixture("receipt-print-hub") });
    const [request] = sent;
    expect(request?.headers.get("anthropic-beta")).toBe("server-side-fallback-2026-07-01");
    expect(request?.body).toMatchObject({
      model: "claude-sonnet-5-5",
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema" } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg" } },
            { type: "text", text: "Read this receipt." },
          ],
        },
      ],
    });
  });

  it("asks whether the image is a purchase receipt and what casts doubt on it", async () => {
    const { reader, sent } = fakeApi(200, apiMessage({}));
    await reader.read(await receiptPhoto({ merchant: "PRINT HUB", total: "13.80" }));
    expect(sent[0]?.body).toMatchObject({
      system: expect.stringMatching(/isPurchaseReceipt[\s\S]*concerns/) as unknown,
      output_config: {
        format: {
          schema: {
            required: expect.arrayContaining(["isPurchaseReceipt", "concerns"]) as unknown,
            properties: {
              isPurchaseReceipt: { type: "boolean" },
              concerns: { type: "array" },
            },
          },
        },
      },
    });
  });

  it.each([
    ["a refusal", apiMessage({ stop_reason: "refusal", content: [] }), "REFUSED"],
    ["a truncated answer", apiMessage({ stop_reason: "max_tokens" }), "TRUNCATED"],
    ["no text", apiMessage({ content: [] }), "NO_OUTPUT"],
    ["text that is not JSON", apiMessage({ content: text("The total is 13.80") }), "NO_OUTPUT"],
    [
      "JSON outside the schema",
      apiMessage({ content: text(JSON.stringify({ total: 13.8 })) }),
      "INVALID_OUTPUT",
    ],
    [
      "a reading without the purchase check",
      apiMessage({
        content: text(
          JSON.stringify({
            readable: true,
            total: "13.80",
            currency: "SGD",
            merchant: "PRINT HUB",
          }),
        ),
      }),
      "INVALID_OUTPUT",
    ],
  ])("turns %s into a typed failure", async (_label, body, code) => {
    const { reader } = fakeApi(200, body);
    await expect(
      reader.read(await receiptPhoto({ merchant: "PRINT HUB", total: "13.80" })),
    ).rejects.toMatchObject({ code });
  });

  it("turns an API error into a typed failure", async () => {
    const { reader } = fakeApi(400, {
      type: "error",
      error: { type: "invalid_request_error", message: "bad image" },
    });
    await expect(
      reader.read(await receiptPhoto({ merchant: "PRINT HUB", total: "13.80" })),
    ).rejects.toMatchObject({ code: "API_ERROR" });
  });

  it("rides out three overloaded replies in a row and returns the reading", async () => {
    const { reader, sent } = sequencedApi([
      overloaded,
      overloaded,
      overloaded,
      { status: 200, body: apiMessage({}) },
    ]);
    const reply = await reader.read(await receiptPhoto({ merchant: "PRINT HUB", total: "13.80" }));
    expect(reply.reading).toEqual(receiptFixture("receipt-print-hub"));
    expect(sent).toHaveLength(4);
  });

  it("gives up with a typed failure once every retry is spent", async () => {
    const { reader, sent } = sequencedApi([overloaded]);
    await expect(
      reader.read(await receiptPhoto({ merchant: "PRINT HUB", total: "13.80" })),
    ).rejects.toMatchObject({ code: "API_ERROR" });
    expect(sent).toHaveLength(receiptCallLimits.maxRetries + 1);
  });

  it("does not retry a request the API rejected as invalid", async () => {
    const { reader, sent } = sequencedApi([
      {
        status: 400,
        body: { type: "error", error: { type: "invalid_request_error", message: "bad image" } },
      },
    ]);
    await expect(
      reader.read(await receiptPhoto({ merchant: "PRINT HUB", total: "13.80" })),
    ).rejects.toMatchObject({ code: "API_ERROR" });
    expect(sent).toHaveLength(1);
  });
});
