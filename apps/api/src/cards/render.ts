import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { cardSvg, paperSizes, printDpi, type CardContent } from "./template";

export interface RenderedCard {
  readonly png: Buffer;
  readonly pdf: Uint8Array;
}

const pointsPerMillimetre = 72 / 25.4;

const cardPdf = async (png: Buffer, content: CardContent, createdAt: Date): Promise<Uint8Array> => {
  const { widthMm, heightMm } = paperSizes[content.printFormat];
  const document = await PDFDocument.create({ updateMetadata: false });
  document.setTitle(`${content.brandName} card for spot ${content.spotCode}`);
  document.setCreator("Datum");
  document.setProducer("Datum");
  document.setCreationDate(createdAt);
  document.setModificationDate(createdAt);
  const page = document.addPage([widthMm * pointsPerMillimetre, heightMm * pointsPerMillimetre]);
  const image = await document.embedPng(png);
  page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  return document.save();
};

export async function renderCard(content: CardContent, createdAt: Date): Promise<RenderedCard> {
  const { svg } = cardSvg(content);
  const png = await sharp(Buffer.from(svg))
    .flatten({ background: "#ffffff" })
    .png({ compressionLevel: 9 })
    .withMetadata({ density: printDpi })
    .toBuffer();
  return { png, pdf: await cardPdf(png, content, createdAt) };
}
