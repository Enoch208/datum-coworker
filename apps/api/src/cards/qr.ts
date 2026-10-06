import QRCode from "qrcode";

export const qrQuietModules = 4;

export interface QrSymbol {
  readonly modules: number;
  readonly darkPath: string;
}

export const qrSymbol = (text: string): QrSymbol => {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const segments: string[] = [];
  for (let row = 0; row < modules.size; row += 1) {
    for (let column = 0; column < modules.size; column += 1) {
      if (modules.get(row, column) === 1) {
        segments.push(
          `M${String(column + qrQuietModules)} ${String(row + qrQuietModules)}h1v1h-1z`,
        );
      }
    }
  }
  return { modules: modules.size + qrQuietModules * 2, darkPath: segments.join("") };
};
