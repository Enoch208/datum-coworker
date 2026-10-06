import { readAsset, writeAsset } from "../cards/store";
import { isStoredImageName, newStoredImageName } from "./files";

export async function storeImage(evidenceDir: string, jpeg: Buffer): Promise<string> {
  const name = newStoredImageName();
  await writeAsset(evidenceDir, name, jpeg);
  return name;
}

export async function readStoredImage(evidenceDir: string, name: string): Promise<Buffer | null> {
  if (!isStoredImageName(name)) return null;
  return readAsset(evidenceDir, name);
}
