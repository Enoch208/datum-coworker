import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { readQrTexts } from "../../src/evidence/qr-reader";

export async function decodeQr(png: Uint8Array): Promise<string | null> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [text] = await readQrTexts({ data, width: info.width, height: info.height }, () => true);
  return text ?? null;
}

export async function pngShape(png: Uint8Array) {
  const { width, height, density, format } = await sharp(png).metadata();
  return { width, height, density, format };
}

export async function pdfPages(pdf: Uint8Array) {
  const document = await PDFDocument.load(pdf);
  return document.getPages().map((page) => ({
    widthMm: Math.round((page.getWidth() / 72) * 25.4 * 100) / 100,
    heightMm: Math.round((page.getHeight() / 72) * 25.4 * 100) / 100,
  }));
}
