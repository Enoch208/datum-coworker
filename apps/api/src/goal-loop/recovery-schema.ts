import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { RecoveryProposal } from "@datum/db";
import { z } from "zod";
import {
  createStructuredModel,
  type AnthropicPlannerOptions,
  type PlannerModel,
} from "../planner/model";

export const runnerNoteLimit = 240;
export const rationaleLimit = 280;

const proposedAction = z.strictObject({
  spotCodes: z
    .array(z.string())
    .describe("The unresolved spot codes this one runner trip covers, each spot in one trip only"),
  dueInMinutes: z
    .int()
    .describe("Minutes from now the runner has for this trip, never more than minutesToDeadline"),
  runnerNote: z
    .string()
    .describe(
      `One or two plain sentences for the runner on what to do differently this time, at most ${String(runnerNoteLimit)} characters`,
    ),
});

export const recoveryOutputSchema = z.strictObject({
  actions: z.array(proposedAction),
  rationale: z
    .string()
    .describe(`One plain sentence on why this plan, at most ${String(rationaleLimit)} characters`),
}) satisfies z.ZodType<RecoveryProposal>;

const singleLine = (text: string): string => text.replace(/\s+/g, " ").trim();

export const checkedProposal = (output: unknown): RecoveryProposal | string => {
  const parsed = recoveryOutputSchema.safeParse(output);
  if (!parsed.success) return z.prettifyError(parsed.error);
  const actions = parsed.data.actions.map((action) => ({
    ...action,
    runnerNote: singleLine(action.runnerNote),
  }));
  const rationale = singleLine(parsed.data.rationale);
  if (actions.some((action) => action.runnerNote.length > runnerNoteLimit)) {
    return `A runner note is longer than ${String(runnerNoteLimit)} characters`;
  }
  if (rationale.length > rationaleLimit) {
    return `The rationale is longer than ${String(rationaleLimit)} characters`;
  }
  if (actions.some((action) => action.dueInMinutes < 1)) {
    return "A trip must give the runner at least one minute";
  }
  return { actions, rationale };
};

export const recoveryCallLimits = { timeoutMs: 20_000, maxRetries: 0 } as const;

export const createAnthropicRecoveryPlanner = (options: AnthropicPlannerOptions): PlannerModel =>
  createStructuredModel(
    options,
    betaZodOutputFormat(recoveryOutputSchema).schema,
    recoveryCallLimits,
  );
