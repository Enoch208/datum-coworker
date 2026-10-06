import { buildSpotQrUrl, parseSpotQrUrl } from "@datum/core";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { renderCard } from "../../src/cards/render";
import { readQrTexts } from "../../src/evidence/qr-reader";
import { appBaseUrl } from "../support";
import { photographCard, plainScene, type Scene } from "./scene";

const campaignId = "cmp_7k2m9q4w8z1x3c5v";
const spotUrl = (spotCode: string) => buildSpotQrUrl(appBaseUrl, { campaignId, spotCode });
const isSpotUrl = (text: string) => parseSpotQrUrl(appBaseUrl, text) !== null;

const cardFor = async (qrTargetUrl: string, spotCode: string): Promise<Buffer> =>
  (
    await renderCard(
      {
        brandName: "Kopi Lab",
        copy: {
          headline: "Your oat flat white is on us",
          subcopy:
            "Scan the code, show this card at Kopi Lab and the first oat flat white is free.",
        },
        printFormat: "A6",
        spotCode,
        qrTargetUrl,
      },
      new Date("2026-10-06T00:00:00Z"),
    )
  ).png;

const cards = new Map<string, Buffer>();

beforeAll(async () => {
  cards.set("A", await cardFor(spotUrl("A"), "A"));
  cards.set("B", await cardFor(spotUrl("B"), "B"));
  cards.set("menu", await cardFor("https://cafe.example/menu", "A"));
});

const card = (name: string): Buffer => {
  const found = cards.get(name);
  if (found === undefined) throw new Error(`No rendered card ${name}`);
  return found;
};

async function readPhoto(photo: Buffer, accept = isSpotUrl): Promise<string[]> {
  const { data, info } = await sharp(photo)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return readQrTexts({ data, width: info.width, height: info.height }, accept);
}

const photo = (name: string, scene: Partial<Scene>, seed: number) =>
  photographCard(card(name), { ...plainScene, seed, ...scene });

const realisticPhotos: [string, Partial<Scene>][] = [
  ["a small upright card at 20% of a 4000x3000 frame", { cardWidthFraction: 0.2 }],
  ["a small upright card at 30% of the frame", { cardWidthFraction: 0.3 }],
  ["a card rotated 10 degrees", { rotateDegrees: 10 }],
  ["a card rotated 25 degrees", { rotateDegrees: 25, cardWidthFraction: 0.22 }],
  ["a perspective tilt", { tilt: 0.18 }],
  ["slight blur", { blurSigma: 3 }],
  ["JPEG quality 60", { jpegQuality: 60 }],
  ["partial glare over the code", { glare: 0.9 }],
  ["low light", { brightness: 0.3, grain: 18 }],
  [
    "rotation, tilt, blur, glare, low light and JPEG 60 at once",
    {
      rotateDegrees: 18,
      tilt: 0.15,
      blurSigma: 2.5,
      glare: 0.75,
      brightness: 0.35,
      grain: 18,
      jpegQuality: 60,
    },
  ],
];

const hardPhotos: [string, Partial<Scene>][] = [
  ["a card only 7% of the frame wide", { cardWidthFraction: 0.07 }],
  ["a steep 0.4 tilt", { tilt: 0.4, rotateDegrees: 8 }],
  ["a shadow across the code", { shadow: 0.8 }],
  ["a card behind hazy glass", { haze: 0.6 }],
  ["strong defocus", { blurSigma: 8 }],
];

describe("reading spot QR codes from synthesised phone photos of real cards", () => {
  it.each(realisticPhotos.map(([label, scene], index) => [label, scene, index] as const))(
    "reads the spot from %s",
    async (_label, scene, index) => {
      const spotCode = index % 2 === 0 ? "A" : "B";
      expect(await readPhoto(await photo(spotCode, scene, 200 + index))).toEqual([
        spotUrl(spotCode),
      ]);
    },
  );

  it.each(hardPhotos.map(([label, scene], index) => [label, scene, index] as const))(
    "still reads the spot from %s",
    async (_label, scene, index) => {
      expect(await readPhoto(await photo("A", scene, 400 + index))).toEqual([spotUrl("A")]);
    },
  );

  it("returns no code, never a wrong one, from a photo too degraded to read", async () => {
    const ruined = await photo(
      "A",
      {
        cardWidthFraction: 0.12,
        rotateDegrees: 20,
        tilt: 0.3,
        motionBlur: 11,
        blurSigma: 3,
        shadow: 0.5,
        haze: 0.35,
        glare: 0.8,
        brightness: 0.35,
        grain: 22,
        jpegQuality: 60,
      },
      500,
    );
    expect(await readPhoto(ruined)).toEqual([]);
  });

  it("ignores a QR code that is not a Datum spot link", async () => {
    const menu = await photo("menu", {}, 600);
    expect(await readPhoto(menu, () => true)).toEqual(["https://cafe.example/menu"]);
    expect(await readPhoto(menu)).toEqual([]);
  });

  it("finds nothing in a photo without a card", async () => {
    const blank = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: "#7a8a7f" },
    })
      .jpeg()
      .toBuffer();
    expect(await readPhoto(blank)).toEqual([]);
  });
});
