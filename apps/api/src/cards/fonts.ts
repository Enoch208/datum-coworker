import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import opentype, { type Font } from "opentype.js";

const resolvePackageFile = createRequire(import.meta.url).resolve;

const loadFont = (specifier: string): Font => {
  const bytes = readFileSync(resolvePackageFile(specifier));
  return opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};

export interface CardFonts {
  readonly bold: Font;
  readonly semibold: Font;
  readonly regular: Font;
  readonly mono: Font;
}

export const cardFonts: CardFonts = {
  bold: loadFont("@fontsource/geist-sans/files/geist-sans-latin-700-normal.woff"),
  semibold: loadFont("@fontsource/geist-sans/files/geist-sans-latin-600-normal.woff"),
  regular: loadFont("@fontsource/geist-sans/files/geist-sans-latin-400-normal.woff"),
  mono: loadFont("@fontsource/geist-mono/files/geist-mono-latin-500-normal.woff"),
};

const copyFonts = [cardFonts.bold, cardFonts.regular];

export const unprintableCharacters = (text: string): string[] => [
  ...new Set(
    Array.from(text).filter(
      (character) =>
        character !== " " && copyFonts.some((font) => font.charToGlyphIndex(character) === 0),
    ),
  ),
];
