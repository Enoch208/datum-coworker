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
