import { describe, expect, it } from "vitest";
import { assetHash, spotsHash } from "../src/services/hashes";

const spots = [
  {
    code: "B",
    name: "Notice board",
    instructions: "Pin it",
    qrTargetUrl: "https://usedatum.xyz/c/cmp_1/B",
  },
  {
    code: "A",
    name: "Cafe window",
    instructions: "Tape inside",
    qrTargetUrl: "https://usedatum.xyz/c/cmp_1/A",
  },
];

describe("asset and spot hashes", () => {
  it("hashes the canonical spot set with sha256", () => {
    expect(spotsHash(spots)).toBe(
      "bb488fbc0041dcaf12ef9f516c796d83773df65b0619bf50d208d84aadf7e2a4",
    );
    expect(spotsHash([...spots].reverse())).toBe(spotsHash(spots));
  });

  it("pins the asset hash so a change to what it covers is noticed", () => {
    expect(
      assetHash({
        templateVersion: 1,
        brandName: "Kopi Lab",
        copy: { headline: "Free oat flat white", subcopy: "Show this card" },
        printFormat: "A6",
        spots,
      }),
    ).toBe("6cfbaa818673235466631e20fe6405afbaec97ce6dcd1dc6c04b378bc007121a");
  });
});
