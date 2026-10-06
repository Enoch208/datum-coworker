import { copyLimits, printFormats, type PlanDraft } from "@datum/core";
import { z } from "zod";

const printStep = z.strictObject({
  type: z.literal("PRINT_AND_COLLECT"),
  quantity: z.int().describe("Copies to print, at least one per approved spot"),
});

const placeStep = z.strictObject({
  type: z.literal("PLACE_SPOT"),
  spotCode: z.string().describe("One of the approved spot codes"),
});

export const plannerOutputSchema = z.strictObject({
  headline: z.string().describe(`Card headline, at most ${String(copyLimits.headline)} characters`),
  subcopy: z.string().describe(`Card subcopy, at most ${String(copyLimits.subcopy)} characters`),
  printFormat: z.enum(printFormats),
  assumptions: z.array(z.string()),
  customerWarnings: z.array(z.string()),
  steps: z.array(z.discriminatedUnion("type", [printStep, placeStep])),
}) satisfies z.ZodType<PlanDraft>;
