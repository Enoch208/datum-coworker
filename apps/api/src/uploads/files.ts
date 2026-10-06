import { randomBytes } from "node:crypto";

const storedImagePattern = /^[0-9a-f]{32}\.jpg$/;

export const newStoredImageName = (): string => `${randomBytes(16).toString("hex")}.jpg`;

export const isStoredImageName = (name: string): boolean => storedImagePattern.test(name);

export const evidenceFileUrl = (appBaseUrl: string, file: string): string =>
  `${appBaseUrl}/evidence/${file}`;
