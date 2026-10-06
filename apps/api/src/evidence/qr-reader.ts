import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import sharp, { type Sharp } from "sharp";
import { prepareZXingModule, readBarcodes, type ReaderOptions } from "zxing-wasm/reader";

const wasm = readFileSync(
  createRequire(import.meta.url).resolve("zxing-wasm/reader/zxing_reader.wasm"),
);

prepareZXingModule({
  overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) },
});

export interface RgbaPixels {
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
}

interface Attempt {
  readonly prepare: ((image: Sharp) => Sharp) | null;
  readonly denoise: boolean;
}

const within = (side: number) => (image: Sharp) =>
  image.resize(side, side, { fit: "inside", withoutEnlargement: true });

const attempts: readonly Attempt[] = [
  { prepare: null, denoise: false },
  { prepare: within(2400), denoise: false },
  { prepare: within(1600), denoise: false },
  { prepare: (image) => within(1600)(image).sharpen({ sigma: 2 }), denoise: false },
  { prepare: within(1000), denoise: false },
  { prepare: null, denoise: true },
];

const options = (denoise: boolean): ReaderOptions => ({
  formats: ["QRCode"],
  tryHarder: true,
  tryDenoise: denoise,
});

async function pixelsFor(source: RgbaPixels, attempt: Attempt): Promise<RgbaPixels> {
  if (attempt.prepare === null) return source;
  const raw = { width: source.width, height: source.height, channels: 4 } as const;
  const { data, info } = await attempt
    .prepare(sharp(source.data, { raw }))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function readAttempt(source: RgbaPixels, attempt: Attempt): Promise<string[]> {
  const pixels = await pixelsFor(source, attempt);
  const image = {
    data: new Uint8ClampedArray(pixels.data),
    width: pixels.width,
    height: pixels.height,
    colorSpace: "srgb" as const,
  };
  const results = await readBarcodes(image, options(attempt.denoise));
  return results.filter((result) => result.isValid).map((result) => result.text);
}

export async function readQrTexts(
  source: RgbaPixels,
  accept: (text: string) => boolean,
): Promise<string[]> {
  for (const attempt of attempts) {
    const accepted = (await readAttempt(source, attempt)).filter(accept);
    if (accepted.length > 0) return [...new Set(accepted)];
  }
  return [];
}
