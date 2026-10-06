import { createHash } from "node:crypto";
import {
  assetDocument,
  canonicalJson,
  spotSetDocument,
  type AssetFingerprint,
  type CanonicalValue,
  type SpotFingerprint,
} from "@datum/core";

const sha256Of = (document: CanonicalValue): string =>
  createHash("sha256").update(canonicalJson(document), "utf8").digest("hex");

export const assetHash = (asset: AssetFingerprint): string => sha256Of(assetDocument(asset));

export const spotsHash = (spots: readonly SpotFingerprint[]): string =>
  sha256Of(spotSetDocument(spots));
