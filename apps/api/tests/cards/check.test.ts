import { describe, expect, it } from "vitest";
import { printRejection, type CardSubject } from "../../src/cards/check";
import { unprintableCharacters } from "../../src/cards/fonts";

const subject: CardSubject = {
  brandName: "Kopi Lab",
  printFormat: "A6",
  spots: [{ code: "A", qrTargetUrl: "https://usedatum.xyz/c/cmp_k3j9x2m4p7q8r5t6/A" }],
};

describe("printRejection", () => {
  it("accepts Latin copy with accents, curly quotes and currency signs", () => {
    expect(
      printRejection(
        { headline: "Café’s €2 flat white", subcopy: "Scan—then show this." },
        subject,
      ),
    ).toBeNull();
  });

  it("refuses characters the card font cannot print", () => {
    expect(printRejection({ headline: "Free coffee ☕", subcopy: "咖啡" }, subject)).toEqual({
      reason: "UNPRINTABLE_COPY",
      detail: 'The card font cannot print "☕", "咖", "啡"',
    });
  });

  it("refuses a link too long to print on one line", () => {
    const longLink = `https://${"x".repeat(120)}.example/c/cmp_k3j9x2m4p7q8r5t6/A`;
    expect(
      printRejection(
        { headline: "Free coffee", subcopy: "Scan me" },
        { ...subject, spots: [{ code: "A", qrTargetUrl: longLink }] },
      ),
    ).toMatchObject({ reason: "COPY_DOES_NOT_FIT" });
  });
});

describe("unprintableCharacters", () => {
  it("lists each missing character once", () => {
    expect(unprintableCharacters("☕ ☕ ok")).toEqual(["☕"]);
  });
});
