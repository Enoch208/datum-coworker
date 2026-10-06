import type { EnrollRunnerRequest, LabelInducedMissRequest } from "@datum/core";
import { z } from "zod";

export const enrollRunnerSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  expiresAt: z.iso
    .datetime({ offset: true })
    .transform((value) => new Date(value))
    .refine((expiresAt) => expiresAt.getTime() > Date.now(), "The link must expire in the future"),
}) satisfies z.ZodType<unknown, EnrollRunnerRequest>;

export type EnrollRunnerInput = z.output<typeof enrollRunnerSchema>;

export const labelInducedMissSchema = z.strictObject({
  inducedMiss: z.boolean(),
}) satisfies z.ZodType<unknown, LabelInducedMissRequest>;
