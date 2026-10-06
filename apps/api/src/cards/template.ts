import type { PrintFormat, PublicCopy } from "@datum/core";
import type { Font } from "opentype.js";
import { cardFonts } from "./fonts";
import {
  CardLayoutError,
  fitExactLine,
  fitOneLine,
  fitParagraph,
  paragraphHeight,
  type FittedText,
} from "./layout";
import { qrSymbol } from "./qr";

export const cardTemplateVersion = 1;
export const printDpi = 300;

export const paperSizes: Readonly<Record<PrintFormat, { widthMm: number; heightMm: number }>> = {
  A6: { widthMm: 105, heightMm: 148 },
  A5: { widthMm: 148, heightMm: 210 },
};

export interface CardContent {
  readonly brandName: string;
  readonly copy: PublicCopy;
  readonly printFormat: PrintFormat;
  readonly spotCode: string;
  readonly qrTargetUrl: string;
}

export interface CardSvg {
  readonly svg: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

interface Frame {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly margin: number;
  readonly inner: number;
}

interface Drawn {
  readonly svg: string;
  readonly bottom: number;
}

const ink = "#0a0a0a";
const softInk = "#27272a";
const quietInk = "#52525b";

export const pixelsFor = (millimetres: number): number =>
  Math.round((millimetres / 25.4) * printDpi);

const mm = (value: number): string => value.toFixed(3);

const frameFor = (printFormat: PrintFormat): Frame => {
  const { widthMm: width, heightMm: height } = paperSizes[printFormat];
  const scale = width / 105;
  const margin = 8 * scale;
  return { width, height, scale, margin, inner: width - margin * 2 };
};

const textPath = (
  font: Font,
  text: string,
  x: number,
  baseline: number,
  size: number,
  fill: string,
) => `<path fill="${fill}" d="${font.getPath(text, x, baseline, size).toPathData(3)}"/>`;

const paragraph = (
  font: Font,
  fitted: FittedText,
  frame: Frame,
  top: number,
  leading: number,
  fill: string,
): Drawn => {
  const baseline = (index: number) => top + fitted.size * (0.92 + index * leading);
  const svg = fitted.lines
    .map((line, index) => textPath(font, line, frame.margin, baseline(index), fitted.size, fill))
    .join("");
  return { svg, bottom: top + paragraphHeight(fitted.lines.length, fitted.size, leading) };
};

const header = (content: CardContent, frame: Frame): Drawn => {
  const { mono, semibold } = cardFonts;
  const { margin, inner, scale, width } = frame;
  const label = `SPOT ${content.spotCode}`;
  const labelSize = 2.8 * scale;
  const labelWidth = mono.getAdvanceWidth(label, labelSize);
  const brand = fitOneLine(content.brandName, {
    font: semibold,
    maxWidth: inner - labelWidth - 4 * scale,
    startSize: 4.2 * scale,
    minSize: 2.6 * scale,
  });
  const baseline = margin + 3.4 * scale;
  const ruleTop = margin + 6.5 * scale;
  const svg = [
    textPath(semibold, brand.lines[0] ?? "", margin, baseline, brand.size, ink),
    textPath(mono, label, width - margin - labelWidth, baseline, labelSize, quietInk),
    `<rect x="${mm(margin)}" y="${mm(ruleTop)}" width="${mm(inner)}" height="${mm(0.35 * scale)}" fill="${ink}"/>`,
  ].join("");
  return { svg, bottom: ruleTop };
};

const headlineLeading = 1.1;
const subcopyLeading = 1.32;

const copyBlock = (copy: PublicCopy, frame: Frame, top: number): Drawn => {
  const { bold, regular } = cardFonts;
  const { inner, scale } = frame;
  const headlineSize = 9 * scale;
  const headlineFit = fitParagraph(copy.headline, {
    font: bold,
    maxWidth: inner,
    startSize: headlineSize,
    minSize: 4 * scale,
    leading: headlineLeading,
    maxHeight: paragraphHeight(3, headlineSize, headlineLeading),
  });
  const headline = paragraph(bold, headlineFit, frame, top, headlineLeading, ink);
  const subcopySize = 4.6 * scale;
  const subcopyFit = fitParagraph(copy.subcopy, {
    font: regular,
    maxWidth: inner,
    startSize: subcopySize,
    minSize: 2.8 * scale,
    leading: subcopyLeading,
    maxHeight: paragraphHeight(4, subcopySize, subcopyLeading),
  });
  const subcopyTop = headline.bottom + 4 * scale;
  const subcopy = paragraph(regular, subcopyFit, frame, subcopyTop, subcopyLeading, softInk);
  return { svg: headline.svg + subcopy.svg, bottom: subcopy.bottom };
};

const qrCode = (url: string, x: number, y: number, size: number): string => {
  const symbol = qrSymbol(url);
  const modules = String(symbol.modules);
  return [
    `<svg x="${mm(x)}" y="${mm(y)}" width="${mm(size)}" height="${mm(size)}" viewBox="0 0 ${modules} ${modules}" shape-rendering="crispEdges">`,
    `<rect width="${modules}" height="${modules}" fill="#ffffff"/>`,
    `<path fill="#000000" d="${symbol.darkPath}"/></svg>`,
  ].join("");
};

const footer = (url: string, frame: Frame, textBottom: number): string => {
  const { mono } = cardFonts;
  const { height, margin, inner, scale, width } = frame;
  const shortUrl = fitExactLine(url.replace(/^https?:\/\//, ""), {
    font: mono,
    maxWidth: inner,
    startSize: 2.9 * scale,
    minSize: 2 * scale,
  });
  const line = shortUrl.lines[0] ?? "";
  const urlBaseline = height - margin;
  const qrBottom = urlBaseline - 5.5 * scale;
  const qrSize = Math.min(62 * scale, qrBottom - (textBottom + 3 * scale));
  if (qrSize < 44 * scale) {
    throw new CardLayoutError("The copy leaves no room for a scannable QR code on this card");
  }
  const urlX = (width - mono.getAdvanceWidth(line, shortUrl.size)) / 2;
  return (
    qrCode(url, (width - qrSize) / 2, qrBottom - qrSize, qrSize) +
    textPath(mono, line, urlX, urlBaseline, shortUrl.size, quietInk)
  );
};

export function cardSvg(content: CardContent): CardSvg {
  const frame = frameFor(content.printFormat);
  const top = header(content, frame);
  const copy = copyBlock(content.copy, frame, top.bottom + 5.5 * frame.scale);
  const widthPx = pixelsFor(frame.width);
  const heightPx = pixelsFor(frame.height);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(widthPx)}" height="${String(heightPx)}" viewBox="0 0 ${String(frame.width)} ${String(frame.height)}">`,
    `<rect width="${String(frame.width)}" height="${String(frame.height)}" fill="#ffffff"/>`,
    top.svg,
    copy.svg,
    footer(content.qrTargetUrl, frame, copy.bottom),
    "</svg>",
  ].join("");
  return { svg, widthPx, heightPx };
}
