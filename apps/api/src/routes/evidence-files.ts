import { Hono } from "hono";
import type { ApiDeps } from "../deps";
import { notFound } from "../http/errors";
import { readStoredImage } from "../uploads/store";

export function evidenceFileRoutes(deps: ApiDeps) {
  return new Hono().get("/evidence/:file", async (c) => {
    const file = c.req.param("file");
    const bytes = await readStoredImage(deps.evidenceDir, file);
    if (bytes === null) throw notFound("Evidence file", file);
    c.header("content-type", "image/jpeg");
    c.header("cache-control", "private, max-age=86400");
    c.header("x-content-type-options", "nosniff");
    c.header("content-disposition", "inline");
    return c.body(new Uint8Array(bytes));
  });
}
