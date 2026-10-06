import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  createStructuredModel,
  type AnthropicPlannerOptions,
  type PlannerModel,
} from "@datum/api/campaign-service";
import { z } from "zod";
import { briefPrompt, type BriefSource } from "./prompt";
import { briefOutputSchema, type BriefOutput } from "./schema";

export interface BriefReading {
  readonly model: string;
  readonly brief: BriefOutput;
}

class BriefShapeError extends Error {
  constructor(detail: string) {
    super(`The brief reader answered with an unexpected shape:\n${detail}`);
    this.name = "BriefShapeError";
  }
}

export async function readBrief(model: PlannerModel, source: BriefSource): Promise<BriefReading> {
  const reply = await model.propose(briefPrompt(source));
  const parsed = briefOutputSchema.safeParse(reply.output);
  if (!parsed.success) throw new BriefShapeError(z.prettifyError(parsed.error));
  return { model: reply.model, brief: parsed.data };
}

export const createAnthropicBriefReader = (options: AnthropicPlannerOptions): PlannerModel =>
  createStructuredModel(options, betaZodOutputFormat(briefOutputSchema).schema, {
    timeoutMs: 60_000,
    maxRetries: 2,
  });
