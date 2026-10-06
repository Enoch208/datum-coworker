import { Hono } from "hono";
import type { Db } from "@datum/db";
import { pathId } from "../http/input";
import { recordScan } from "../services/scans";

export function scanRoutes(db: Db) {
  return new Hono().get("/c/:campaignId/:spotCode", async (c) => {
    const campaignId = pathId(c, "campaignId", "cmp", "Campaign");
    const destination = await recordScan(
      db,
      campaignId,
      c.req.param("spotCode"),
      c.req.header("user-agent"),
    );
    c.header("cache-control", "no-store");
    return c.redirect(destination, 302);
  });
}
