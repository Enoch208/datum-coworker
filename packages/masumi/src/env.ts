import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export const httpUrl = z.url({ protocol: /^https?$/ }).transform((url) => url.replace(/\/+$/, ""));

export const defaultDatumDir = (name: string) => join(homedir(), ".datum", name);

export function loadEnv<Schema extends z.ZodType>(
  schema: Schema,
  source: NodeJS.ProcessEnv,
): z.output<Schema> {
  const present = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ""),
  );
  const parsed = schema.safeParse(present);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `  ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Environment is incomplete:\n${problems.join("\n")}`);
  }
  return parsed.data;
}
