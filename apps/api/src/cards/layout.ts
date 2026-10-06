import type { Font } from "opentype.js";

export class CardLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CardLayoutError";
  }
}

export interface SizeRule {
  readonly font: Font;
  readonly maxWidth: number;
  readonly startSize: number;
  readonly minSize: number;
}

export interface ParagraphRule extends SizeRule {
  readonly leading: number;
  readonly maxHeight: number;
}

export interface FittedText {
  readonly size: number;
  readonly lines: string[];
}

const sizeStep = 0.25;

const widthOf = (font: Font, text: string, size: number): number =>
  font.getAdvanceWidth(text, size);

const breakWord = (font: Font, word: string, size: number, maxWidth: number): string[] => {
  const pieces: string[] = [];
  let piece = "";
  for (const character of word) {
    if (piece.length > 0 && widthOf(font, piece + character, size) > maxWidth) {
      pieces.push(piece);
      piece = "";
    }
    piece += character;
  }
  return piece.length > 0 ? [...pieces, piece] : pieces;
};

export const wrapText = (font: Font, text: string, size: number, maxWidth: number): string[] => {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ").filter((part) => part.length > 0)) {
    const candidate = line.length === 0 ? word : `${line} ${word}`;
    if (widthOf(font, candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line.length > 0) lines.push(line);
    const pieces = breakWord(font, word, size, maxWidth);
    lines.push(...pieces.slice(0, -1));
    line = pieces.at(-1) ?? "";
  }
  return line.length > 0 ? [...lines, line] : lines;
};

const ascent = 0.92;
const descent = 0.24;

export const paragraphHeight = (lines: number, size: number, leading: number): number =>
  size * (ascent + (lines - 1) * leading + descent);

const largestFit = (rule: SizeRule, fits: (size: number) => string[] | null): FittedText | null => {
  const steps = Math.floor((rule.startSize - rule.minSize) / sizeStep + 1e-9);
  for (let step = 0; step <= steps; step += 1) {
    const size = rule.startSize - step * sizeStep;
    const lines = fits(size);
    if (lines !== null) return { size, lines };
  }
  return null;
};

export const fitParagraph = (text: string, rule: ParagraphRule): FittedText => {
  const fitted = largestFit(rule, (size) => {
    const lines = wrapText(rule.font, text, size, rule.maxWidth);
    return paragraphHeight(lines.length, size, rule.leading) <= rule.maxHeight ? lines : null;
  });
  if (fitted !== null) return fitted;
  throw new CardLayoutError(`"${text}" does not fit its space on the card`);
};

const oneLine = (text: string, rule: SizeRule): FittedText | null =>
  largestFit(rule, (size) =>
    rule.font.getAdvanceWidth(text, size) <= rule.maxWidth ? [text] : null,
  );

export const fitExactLine = (text: string, rule: SizeRule): FittedText => {
  const fitted = oneLine(text, rule);
  if (fitted !== null) return fitted;
  throw new CardLayoutError(`"${text}" does not fit on one line of the card`);
};

const truncatedToWidth = (text: string, rule: SizeRule): FittedText => {
  let line = text;
  while (line.length > 1 && widthOf(rule.font, `${line}…`, rule.minSize) > rule.maxWidth) {
    line = line.slice(0, -1).trimEnd();
  }
  return { size: rule.minSize, lines: [`${line}…`] };
};

export const fitOneLine = (text: string, rule: SizeRule): FittedText =>
  oneLine(text, rule) ?? truncatedToWidth(text, rule);
