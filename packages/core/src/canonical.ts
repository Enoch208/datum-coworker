import type { PrintFormat, PublicCopy, SpotCode } from "./contract";
import { compareSpotCodes } from "./qr";

export type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

const isList = (value: CanonicalValue): value is readonly CanonicalValue[] => Array.isArray(value);

const isPlainObject = (value: object): value is Record<string, unknown> => {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const asCanonical = (value: unknown): CanonicalValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (Array.isArray(value)) return value.map(asCanonical);
  if (typeof value === "object" && isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, asCanonical(item)]));
  }
  throw new RangeError(`Canonical JSON cannot hold a ${typeof value} of this kind`);
};

export const canonicalJson = (value: CanonicalValue): string => {
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new RangeError(`Canonical JSON holds whole numbers only: ${String(value)}`);
  }
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (isList(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key] ?? null)}`).join(",")}}`;
};

export interface SpotFingerprint {
  code: SpotCode;
  name: string;
  instructions: string;
  qrTargetUrl: string;
}

export interface AssetFingerprint {
  templateVersion: number;
  brandName: string;
  copy: PublicCopy;
  printFormat: PrintFormat;
  spots: readonly SpotFingerprint[];
}

export const spotSetDocument = (spots: readonly SpotFingerprint[]): CanonicalValue =>
  [...spots]
    .sort((left, right) => compareSpotCodes(left.code, right.code))
    .map(({ code, name, instructions, qrTargetUrl }) => ({
      code,
      name,
      instructions,
      qrTargetUrl,
    }));

export const assetDocument = (asset: AssetFingerprint): CanonicalValue => ({
  templateVersion: asset.templateVersion,
  brandName: asset.brandName,
  copy: { headline: asset.copy.headline, subcopy: asset.copy.subcopy },
  printFormat: asset.printFormat,
  spots: spotSetDocument(asset.spots),
});
