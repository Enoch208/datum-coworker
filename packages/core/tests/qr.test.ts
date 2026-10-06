import { describe, expect, it } from "vitest";
import { buildSpotQrUrl, isSpotCode, parseSpotQrUrl } from "../src/qr";

const baseUrl = "https://datum.example";
const campaignId = "cmp_7k2m9q4w8z1x3c5v";
const spotC = { campaignId, spotCode: "C" };
const spotCUrl = `https://datum.example/c/${campaignId}/C`;

describe("isSpotCode", () => {
  it.each(["A", "D", "B2", "AB12"])("accepts %j", (code) => {
    expect(isSpotCode(code)).toBe(true);
  });

  it.each(["", "c", "ABCDE", "A-1", "A ", "Ä"])("rejects %j", (code) => {
    expect(isSpotCode(code)).toBe(false);
  });
});

describe("buildSpotQrUrl", () => {
  it("builds <baseUrl>/c/<campaignId>/<spotCode>", () => {
    expect(buildSpotQrUrl(baseUrl, spotC)).toBe(spotCUrl);
  });

  it("ignores trailing slashes on the base URL", () => {
    expect(buildSpotQrUrl("https://datum.example/", spotC)).toBe(spotCUrl);
  });

  it("keeps a path prefix on the base URL", () => {
    expect(buildSpotQrUrl("https://datum.example/api", spotC)).toBe(
      `https://datum.example/api/c/${campaignId}/C`,
    );
  });

  it.each(["c", "", "ABCDE", "A/B"])("refuses spot code %j", (spotCode) => {
    expect(() => buildSpotQrUrl(baseUrl, { campaignId, spotCode })).toThrow(RangeError);
  });

  it.each(["", "cmp/1", "cmp 1", "cmp?1", "a".repeat(65)])("refuses campaign id %j", (id) => {
    expect(() => buildSpotQrUrl(baseUrl, { campaignId: id, spotCode: "A" })).toThrow(RangeError);
  });

  it.each(["", "datum.example", "ftp://datum.example", "https://", "https://datum.example?x=1"])(
    "refuses base URL %j",
    (base) => {
      expect(() => buildSpotQrUrl(base, spotC)).toThrow(RangeError);
    },
  );
});

describe("parseSpotQrUrl", () => {
  it("parses a Datum spot URL into its payload", () => {
    expect(parseSpotQrUrl(baseUrl, spotCUrl)).toEqual(spotC);
  });

  it("round-trips every demo spot", () => {
    for (const spotCode of ["A", "B", "C", "D"]) {
      const payload = { campaignId, spotCode };
      expect(parseSpotQrUrl(baseUrl, buildSpotQrUrl(baseUrl, payload))).toEqual(payload);
    }
  });

  it("accepts a base URL configured with a trailing slash", () => {
    expect(parseSpotQrUrl("https://datum.example/", spotCUrl)).toEqual(spotC);
  });

  it.each([
    ["another host", `https://evil.example/c/${campaignId}/C`],
    ["a host that only starts like ours", `https://datum.example.evil/c/${campaignId}/C`],
    ["another scheme", `http://datum.example/c/${campaignId}/C`],
    ["another route", `https://datum.example/x/${campaignId}/C`],
    ["an extra segment", `https://datum.example/c/${campaignId}/C/extra`],
    ["a trailing slash", `https://datum.example/c/${campaignId}/C/`],
    ["a missing spot", `https://datum.example/c/${campaignId}`],
    ["an empty campaign", "https://datum.example/c//C"],
    ["a lowercase spot", `https://datum.example/c/${campaignId}/c`],
    ["a five character spot", `https://datum.example/c/${campaignId}/ABCDE`],
    ["a query string", `https://datum.example/c/${campaignId}/C?utm=1`],
    ["a fragment", `https://datum.example/c/${campaignId}/C#top`],
    ["surrounding whitespace", ` ${spotCUrl}`],
    ["plain text", "hello"],
    ["an empty string", ""],
  ])("returns null for %s", (_label, text) => {
    expect(parseSpotQrUrl(baseUrl, text)).toBeNull();
  });
});
