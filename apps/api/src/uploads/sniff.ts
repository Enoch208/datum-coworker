export type ImageKind = "jpeg" | "png" | "webp";

export type SniffedKind = ImageKind | "heic" | null;

const heicBrands: ReadonlySet<string> = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const jpegSignature = [0xff, 0xd8, 0xff];

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  signature.every((byte, index) => bytes[index] === byte);

const asciiAt = (bytes: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

export function sniffImage(bytes: Uint8Array): SniffedKind {
  if (startsWith(bytes, jpegSignature)) return "jpeg";
  if (startsWith(bytes, pngSignature)) return "png";
  if (asciiAt(bytes, 0, 4) === "RIFF" && asciiAt(bytes, 8, 4) === "WEBP") return "webp";
  if (asciiAt(bytes, 4, 4) === "ftyp" && heicBrands.has(asciiAt(bytes, 8, 4))) return "heic";
  return null;
}
