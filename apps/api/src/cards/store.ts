import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type CardFile = "png" | "pdf";

export const cardFiles: readonly CardFile[] = ["png", "pdf"];

export const cardAssetKey = (
  campaignId: string,
  assetVersion: number,
  spotCode: string,
  file: CardFile,
): string => `${campaignId}/v${String(assetVersion)}/${spotCode}.${file}`;

export const cardAssetUrl = (appBaseUrl: string, key: string): string =>
  `${appBaseUrl}/assets/${key}`;

export async function writeAsset(root: string, key: string, bytes: Uint8Array): Promise<void> {
  const target = join(root, key);
  await mkdir(dirname(target), { recursive: true });
  const staging = `${target}.${randomUUID()}.partial`;
  await writeFile(staging, bytes);
  await rename(staging, target);
}

const isMissingFile = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

export async function readAsset(root: string, key: string): Promise<Buffer | null> {
  try {
    return await readFile(join(root, key));
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}
