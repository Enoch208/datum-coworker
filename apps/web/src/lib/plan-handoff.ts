import { z } from "zod";

const handoffSchema = z.object({ planFailure: z.string() });

export interface PlanHandoff {
  readonly planFailure: string;
}

export const readPlanHandoff = (state: unknown): string | null => {
  const parsed = handoffSchema.safeParse(state);
  return parsed.success ? parsed.data.planFailure : null;
};
