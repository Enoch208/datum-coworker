import { describe, expect, it } from "vitest";
import { cardFonts } from "../../src/cards/fonts";
import {
  CardLayoutError,
  fitExactLine,
  fitOneLine,
  fitParagraph,
  paragraphHeight,
  wrapText,
} from "../../src/cards/layout";

const { bold, mono } = cardFonts;

describe("wrapText", () => {
  it("breaks between words to stay inside the width", () => {
    const lines = wrapText(bold, "Your oat flat white is on us", 9, 89);
    expect(lines.join(" ")).toBe("Your oat flat white is on us");
    expect(lines.every((line) => bold.getAdvanceWidth(line, 9) <= 89)).toBe(true);
  });

  it("splits a word that is wider than a whole line", () => {
    const lines = wrapText(bold, "W".repeat(40), 9, 89);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("W".repeat(40));
  });
});

describe("fitParagraph", () => {
  const rule = { font: bold, maxWidth: 89, startSize: 9, minSize: 4, leading: 1.1 };

  it("keeps the start size when the text fits", () => {
    const maxHeight = paragraphHeight(3, 9, 1.1);
    expect(fitParagraph("Free coffee", { ...rule, maxHeight })).toEqual({
      size: 9,
      lines: ["Free coffee"],
    });
  });

  it("shrinks the text until it fits the height", () => {
    const maxHeight = paragraphHeight(1, 9, 1.1);
    const fitted = fitParagraph("Your oat flat white is on us", { ...rule, maxHeight });
    expect(fitted.size).toBeLessThan(9);
    expect(fitted.lines).toHaveLength(1);
  });

  it("refuses text that cannot fit at the smallest size", () => {
    expect(() =>
      fitParagraph("W".repeat(400), { ...rule, maxHeight: paragraphHeight(1, 9, 1.1) }),
    ).toThrow(CardLayoutError);
  });
});

describe("single lines", () => {
  const rule = { font: mono, maxWidth: 40, startSize: 3, minSize: 2 };

  it("never truncates an exact line such as the printed link", () => {
    expect(() => fitExactLine("x".repeat(80), rule)).toThrow(CardLayoutError);
  });

  it("truncates a decorative line such as a long brand name", () => {
    const fitted = fitOneLine("x".repeat(80), rule);
    expect(fitted.lines[0]?.endsWith("…")).toBe(true);
    expect(mono.getAdvanceWidth(fitted.lines[0] ?? "", fitted.size)).toBeLessThanOrEqual(40);
  });
});
