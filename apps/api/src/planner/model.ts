import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { PlannerPrompt } from "./prompt";
import { plannerOutputSchema } from "./schema";

export const plannerModelId = "claude-sonnet-5-5";

export interface PlannerReply {
  readonly model: string;
  readonly output: unknown;
}

export interface PlannerModel {
  propose(prompt: PlannerPrompt): Promise<PlannerReply>;
}

export type PlannerFailure = "REFUSED" | "TRUNCATED" | "NO_OUTPUT" | "API_ERROR";

export class PlannerModelError extends Error {
  readonly code: PlannerFailure;

  constructor(code: PlannerFailure, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PlannerModelError";
    this.code = code;
  }
}

const outputSchema = betaZodOutputFormat(plannerOutputSchema).schema;

const parsedJson = (text: string): unknown => {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch (error) {
    throw new PlannerModelError("NO_OUTPUT", "The planner answered with text that is not JSON", {
      cause: error,
    });
  }
};

const askModel = async (client: Anthropic, prompt: PlannerPrompt) => {
  try {
    return await client.beta.messages.create({
      model: plannerModelId,
      max_tokens: 16_000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: outputSchema } },
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw new PlannerModelError("API_ERROR", `The planner API failed: ${error.message}`, {
        cause: error,
      });
    }
    throw error;
  }
};

export interface AnthropicPlannerOptions {
  readonly apiKey: string;
  readonly fetch?: typeof fetch;
}

export function createAnthropicPlannerModel(options: AnthropicPlannerOptions): PlannerModel {
  const client = new Anthropic({
    apiKey: options.apiKey,
    timeout: 120_000,
    maxRetries: 2,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
  return {
    async propose(prompt) {
      const response = await askModel(client, prompt);
      if (response.stop_reason === "refusal") {
        throw new PlannerModelError("REFUSED", "The planner declined to plan this campaign");
      }
      if (response.stop_reason === "max_tokens") {
        throw new PlannerModelError("TRUNCATED", "The planner ran out of room before finishing");
      }
      const text = response.content.find((block) => block.type === "text");
      if (text === undefined) {
        throw new PlannerModelError("NO_OUTPUT", "The planner returned no plan");
      }
      return { model: response.model, output: parsedJson(text.text) };
    },
  };
}
