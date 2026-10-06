import { createHash } from "node:crypto";
import sharp from "sharp";
import type { RgbaPixels } from "../evidence/qr-reader";
import { HttpError } from "../http/errors";
import { sniffImage } from "./sniff";

export const maxUploadBytes = 12 * 1024 * 1024;
const maxStoredSide = 4096;
const maxInputPixels = 100_000_000;

export interface AcceptedImage {
  readonly contentHash: string;
  readonly jpeg: Buffer;
  readonly pixels: RgbaPixels;
}

export function assertAcceptableImage(bytes: Uint8Array, what: string): void {
  if (bytes.byteLength > maxUploadBytes) {
    throw new HttpError(413, "UPLOAD_TOO_LARGE", `The ${what} is larger than 12 MB`);
  }
  const kind = sniffImage(bytes);
  if (kind === "heic") {
    throw new HttpError(
      415,
      "UNSUPPORTED_IMAGE",
      `This ${what} is HEIC. Set the camera to Most Compatible or upload a JPEG`,
    );
  }
  if (kind === null) {
    throw new HttpError(
      415,
      "UNSUPPORTED_IMAGE",
      `Upload the ${what} as a JPEG, PNG or WebP image`,
    );
  }
}

export const contentHashOf = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

async function orientedPixels(bytes: Uint8Array): Promise<RgbaPixels> {
  const { data, info } = await sharp(bytes, { limitInputPixels: maxInputPixels })
    .rotate()
    .resize(maxStoredSide, maxStoredSide, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const strippedJpeg = (pixels: RgbaPixels): Promise<Buffer> =>
  sharp(pixels.data, { raw: { width: pixels.width, height: pixels.height, channels: 4 } })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85 })
    .toBuffer();

export async function acceptImage(bytes: Uint8Array, what: string): Promise<AcceptedImage> {
  assertAcceptableImage(bytes, what);
  let pixels: RgbaPixels;
  try {
    pixels = await orientedPixels(bytes);
  } catch (error) {
    throw new HttpError(
      422,
      "UNREADABLE_IMAGE",
      `The ${what} could not be decoded as an image: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return { contentHash: contentHashOf(bytes), jpeg: await strippedJpeg(pixels), pixels };
}
