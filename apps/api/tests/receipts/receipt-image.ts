import sharp from "sharp";

export interface ReceiptLines {
  readonly merchant: string;
  readonly total: string;
}

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function receiptPhoto(lines: ReceiptLines): Promise<Buffer> {
  const rows = [
    lines.merchant,
    "12 Amoy Street, Singapore 069950",
    "06/10/2026 19:05   Receipt 004187",
    "",
    `A6 colour print x4     ${lines.total}`,
    "",
    `TOTAL (SGD)            ${lines.total}`,
    `NETS                   ${lines.total}`,
    "GST included",
    "Thank you!",
  ];
  const text = rows
    .map(
      (row, index) =>
        `<text x="60" y="${String(120 + index * 64)}" font-family="Courier New, monospace" font-size="40" fill="#1a1a1a">${escape(row)}</text>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><rect width="900" height="900" fill="#f4f1ea"/>${text}</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}
