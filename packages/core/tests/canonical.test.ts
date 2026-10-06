import { describe, expect, it } from "vitest";
import {
  assetDocument,
  canonicalJson,
  spotSetDocument,
  type AssetFingerprint,
  type SpotFingerprint,
} from "../src/canonical";

const spotA: SpotFingerprint = {
  code: "A",
  name: "Cafe window",
  instructions: "Tape inside",
  qrTargetUrl: "https://usedatum.xyz/c/cmp_1/A",
};
const spotB: SpotFingerprint = {
  code: "B",
  name: "Notice board",
  instructions: "Pin it",
  qrTargetUrl: "https://usedatum.xyz/c/cmp_1/B",
};

const asset: AssetFingerprint = {
  templateVersion: 1,
  brandName: "Kopi Lab",
  copy: { headline: "Free oat flat white", subcopy: "Show this card" },
  printFormat: "A6",
  spots: [spotB, spotA],
};

describe("canonicalJson", () => {
  it("sorts keys at every depth and adds no whitespace", () => {
    expect(canonicalJson({ b: 1, a: { d: [true, null], c: "x" } })).toBe(
      '{"a":{"c":"x","d":[true,null]},"b":1}',
    );
  });

  it("escapes strings exactly as JSON does", () => {
    expect(canonicalJson({ text: 'quote " and é' })).toBe('{"text":"quote \\" and é"}');
  });

  it("refuses numbers that are not whole", () => {
    expect(() => canonicalJson({ amount: 1.5 })).toThrow(RangeError);
  });
});

describe("hash documents", () => {
  it("orders spots by code so the input order never changes the hash", () => {
    expect(canonicalJson(spotSetDocument([spotB, spotA]))).toBe(
      canonicalJson(spotSetDocument([spotA, spotB])),
    );
  });

  it("covers the template, brand, copy, print format and every spot field", () => {
    const base = canonicalJson(assetDocument(asset));
    const changes: AssetFingerprint[] = [
      { ...asset, templateVersion: 2 },
      { ...asset, brandName: "Kopi Lab SG" },
      { ...asset, copy: { ...asset.copy, subcopy: "Show this card today" } },
      { ...asset, printFormat: "A5" },
      { ...asset, spots: [spotA, { ...spotB, instructions: "Pin it high" }] },
      { ...asset, spots: [spotA] },
    ];
    for (const changed of changes) {
      expect(canonicalJson(assetDocument(changed))).not.toBe(base);
    }
  });

  it("ignores fields that are not part of the printed asset", () => {
    const extra = { ...spotA, scanCount: 12 };
    expect(canonicalJson(spotSetDocument([extra]))).toBe(canonicalJson(spotSetDocument([spotA])));
  });
});
