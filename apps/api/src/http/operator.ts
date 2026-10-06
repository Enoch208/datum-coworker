import { createHash, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { HttpError, unavailable } from "./errors";

const digest = (value: string): Buffer => createHash("sha256").update(value, "utf8").digest();

export function requireOperator(operatorKey: string | null): MiddlewareHandler {
  const expected = operatorKey === null ? null : digest(operatorKey);
  return async (c, next) => {
    if (expected === null) {
      throw unavailable(
        "OPERATOR_DISABLED",
        "Operator routes are off until OPERATOR_KEY is set on the server",
      );
    }
    const given = c.req.header("x-operator-key");
    if (given === undefined || !timingSafeEqual(digest(given), expected)) {
      throw new HttpError(401, "UNAUTHORIZED", "A valid x-operator-key header is required");
    }
    await next();
  };
}
