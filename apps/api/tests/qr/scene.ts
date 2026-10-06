import sharp, { type Sharp } from "sharp";
import { lightingOverlays, type CardLighting } from "./lighting";
import { tiltedQuad, warpPerspective, type RgbaImage } from "./warp";

export interface Scene extends CardLighting {
  readonly seed: number;
  readonly cardWidthFraction: number;
  readonly rotateDegrees: number;
  readonly tilt: number;
  readonly blurSigma: number;
  readonly motionBlur: number;
  readonly brightness: number;
  readonly grain: number;
  readonly jpegQuality: number;
}

export const plainScene: Scene = {
  seed: 1,
  cardWidthFraction: 0.25,
  rotateDegrees: 0,
  tilt: 0,
  blurSigma: 0,
  motionBlur: 0,
  glare: 0,
  shadow: 0,
  haze: 0,
  brightness: 1,
  grain: 10,
  jpegQuality: 90,
};

export const photoSize = { width: 4000, height: 3000 } as const;

const randomSource = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const noiseBytes = (length: number, seed: number, centre: number, spread: number): Buffer => {
  const next = randomSource(seed);
  const bytes = Buffer.alloc(length);
  for (let index = 0; index < length; index += 1) {
    const value = centre + (next() + next() - 1) * spread;
    bytes[index] = Math.max(0, Math.min(255, Math.round(value)));
  }
  return bytes;
};

const lossless = (image: Sharp): Promise<Buffer> => image.png({ compressionLevel: 0 }).toBuffer();

const background = (seed: number): Promise<Buffer> => {
  const coarse = { width: 64, height: 48, channels: 3 } as const;
  return lossless(
    sharp(noiseBytes(coarse.width * coarse.height * 3, seed, 128, 120), { raw: coarse }).resize(
      photoSize.width,
      photoSize.height,
      { kernel: "cubic" },
    ),
  );
};

const rgba = async (image: Sharp): Promise<RgbaImage> => {
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};

const litCard = async (card: Uint8Array, scene: Scene): Promise<RgbaImage> => {
  const width = Math.round(photoSize.width * scene.cardWidthFraction);
  const sized = await lossless(sharp(card).resize({ width }));
  const { height } = await sharp(sized).metadata();
  return rgba(sharp(sized).composite(lightingOverlays(width, height, scene)));
};

const placedCard = async (card: Uint8Array, scene: Scene): Promise<Buffer> => {
  const flat = await litCard(card, scene);
  const tilted =
    scene.tilt > 0 ? warpPerspective(flat, tiltedQuad(flat.width, flat.height, scene.tilt)) : flat;
  return lossless(
    sharp(tilted.data, {
      raw: { width: tilted.width, height: tilted.height, channels: 4 },
    }).rotate(scene.rotateDegrees, { background: { r: 0, g: 0, b: 0, alpha: 0 } }),
  );
};

const offset = (scene: Scene, size: number, room: number): number => {
  const next = randomSource(scene.seed * 7919);
  return Math.max(0, Math.round((room - size) * (0.3 + next() * 0.4)));
};

const motionKernel = (length: number) => {
  const size = Math.max(3, length | 1);
  const kernel = Array.from({ length: size * 3 }, (_, index) =>
    index >= size && index < size * 2 ? 1 : 0,
  );
  return { width: size, height: 3, kernel };
};

const focused = async (image: Buffer, scene: Scene): Promise<Buffer> => {
  const exposed = await lossless(sharp(image).linear(scene.brightness, 0));
  const shaken =
    scene.motionBlur > 0
      ? await lossless(sharp(exposed).convolve(motionKernel(scene.motionBlur)))
      : exposed;
  return scene.blurSigma > 0 ? lossless(sharp(shaken).blur(scene.blurSigma)) : shaken;
};

export async function photographCard(card: Uint8Array, scene: Scene): Promise<Buffer> {
  const placed = await placedCard(card, scene);
  const { width, height } = await sharp(placed).metadata();
  const composed = await lossless(
    sharp(await background(scene.seed)).composite([
      {
        input: placed,
        left: offset(scene, width, photoSize.width),
        top: offset(scene, height, photoSize.height),
      },
    ]),
  );
  const grain = noiseBytes(photoSize.width * photoSize.height, scene.seed + 1, 128, scene.grain);
  return sharp(await focused(composed, scene))
    .composite([
      {
        input: grain,
        raw: { width: photoSize.width, height: photoSize.height, channels: 1 },
        blend: "soft-light",
      },
    ])
    .jpeg({ quality: scene.jpegQuality })
    .toBuffer();
}
