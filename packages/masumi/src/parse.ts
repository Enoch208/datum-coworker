import { z } from "zod";

export function parseShape<Schema extends z.ZodType>(
  source: string,
  schema: Schema,
  value: unknown,
): z.output<Schema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`${source} returned an unexpected shape:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
