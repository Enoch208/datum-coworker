import { Hono } from "hono";
import { hasIdShape } from "@datum/db";
import { isSpotCode } from "@datum/core";
import type { ApiDeps } from "../deps";
import { notFound } from "../http/errors";
import { cardFile, type CardFileRequest } from "../services/cards";

const versionPattern = /^v([1-9][0-9]{0,5})$/;
const filePattern = /^([A-Z0-9]{1,4})\.(png|pdf)$/;

const contentTypes = { png: "image/png", pdf: "application/pdf" } as const;

function parseAssetPath(campaignId: string, version: string, file: string): CardFileRequest | null {
  const versionMatch = versionPattern.exec(version);
  const fileMatch = filePattern.exec(file);
  const spotCode = fileMatch?.[1];
  const extension = fileMatch?.[2];
  if (!hasIdShape("cmp", campaignId) || versionMatch?.[1] === undefined) return null;
  if (spotCode === undefined || !isSpotCode(spotCode)) return null;
  if (extension !== "png" && extension !== "pdf") return null;
  return { campaignId, version: Number(versionMatch[1]), spotCode, file: extension };
}

export function assetRoutes(deps: ApiDeps) {
  return new Hono().get("/assets/:campaignId/:version/:file", async (c) => {
    const { campaignId, version, file } = c.req.param();
    const request = parseAssetPath(campaignId, version, file);
    const bytes = request === null ? null : await cardFile(deps.db, deps.assetDir, request);
    if (request === null || bytes === null) throw notFound("Asset", c.req.path);
    c.header("content-type", contentTypes[request.file]);
    c.header("cache-control", "public, max-age=31536000, immutable");
    c.header("x-content-type-options", "nosniff");
    if (request.file === "pdf") {
      const name = `${request.campaignId}-v${String(request.version)}-${request.spotCode}.pdf`;
      c.header("content-disposition", `inline; filename="${name}"`);
    }
    return c.body(new Uint8Array(bytes));
  });
}
