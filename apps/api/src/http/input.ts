import type { Context } from "hono";
import { z } from "zod";
import { hasIdShape, type IdPrefix } from "@datum/db";
import { invalidRequest, notFound } from "./errors";

export function pathId(c: Context, name: string, prefix: IdPrefix, what: string): string {
  const id = c.req.param(name) ?? "";
  if (!hasIdShape(prefix, id)) {
    throw notFound(what, id);
  }
  return id;
}

export async function readBody<Schema extends z.ZodType>(
  c: Context,
  schema: Schema,
): Promise<z.output<Schema>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw invalidRequest("Request body must be valid JSON");
    }
    throw error;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw invalidRequest(z.prettifyError(parsed.error));
  }
  return parsed.data;
}
