import type { PublicCopy } from "@datum/core";
import { describe, expect, it } from "vitest";
import { renderCard } from "../../src/cards/render";
import { cardSvg, type CardContent } from "../../src/cards/template";
import { decodeQr, pdfPages, pngShape } from "./decode";

const copy: PublicCopy = {
  headline: "Your oat flat white is on us",
  subcopy: "Scan the code, show this card at Kopi Lab on Amoy Street and the first one is free.",
};

const card = (overrides: Partial<CardContent> = {}): CardContent => ({
  brandName: "Kopi Lab",
  copy,
  printFormat: "A6",
  spotCode: "A",
  qrTargetUrl: "https://usedatum.xyz/c/cmp_k3j9x2m4p7q8r5t6/A",
  ...overrides,
});

const createdAt = new Date("2026-10-06T09:00:00Z");

describe("renderCard", () => {
  it.each([
    ["A6", 1240, 1748, 105, 148],
    ["A5", 1748, 2480, 148, 210],
  ] as const)(
    "renders a %s card at 300 dpi whose QR decodes to the spot URL",
    async (printFormat, width, height, widthMm, heightMm) => {
      const rendered = await renderCard(card({ printFormat }), createdAt);
      expect(await pngShape(rendered.png)).toEqual({ width, height, density: 300, format: "png" });
      expect(await decodeQr(rendered.png)).toBe("https://usedatum.xyz/c/cmp_k3j9x2m4p7q8r5t6/A");
      expect(await pdfPages(rendered.pdf)).toEqual([{ widthMm, heightMm }]);
    },
  );

  it("gives every spot its own card that scans to its own URL", async () => {
    const spots = ["A", "B", "C"].map((spotCode) =>
      card({ spotCode, qrTargetUrl: `https://usedatum.xyz/c/cmp_k3j9x2m4p7q8r5t6/${spotCode}` }),
    );
    const rendered = await Promise.all(spots.map((content) => renderCard(content, createdAt)));
    const decoded = await Promise.all(rendered.map((files) => decodeQr(files.png)));
    expect(decoded).toEqual(spots.map((content) => content.qrTargetUrl));
    expect(new Set(rendered.map((files) => files.png.toString("base64"))).size).toBe(3);
  });

  it("still scans when the copy is as long and wide as the rules allow", async () => {
    const widest = {
      headline: "WWWWWWWWWWW WWWWWWWWWWW WWWWWWWWWWW WWWWWWWWWWW",
      subcopy: "WWWWWWWWWW ".repeat(11).slice(0, 120),
    };
    for (const printFormat of ["A6", "A5"] as const) {
      const rendered = await renderCard(card({ copy: widest, printFormat }), createdAt);
      expect(await decodeQr(rendered.png)).toBe(card().qrTargetUrl);
    }
  });

  it("draws the same card for the same content", () => {
    expect(cardSvg(card()).svg).toBe(cardSvg(card()).svg);
    expect(cardSvg(card()).svg).not.toBe(cardSvg(card({ spotCode: "B" })).svg);
  });

  it("prints text as outlines so the server's fonts never change the card", () => {
    const { svg } = cardSvg(card());
    expect(svg).not.toContain("<text");
    expect(svg).toContain('width="1240" height="1748" viewBox="0 0 105 148"');
  });
});
