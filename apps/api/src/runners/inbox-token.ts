import { createHash, randomBytes } from "node:crypto";

const inboxTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export const newInboxToken = (): string => randomBytes(32).toString("base64url");

export const isInboxToken = (value: string): boolean => inboxTokenPattern.test(value);

export const hashInboxToken = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex");

export const inboxUrl = (appBaseUrl: string, token: string): string => `${appBaseUrl}/r/${token}`;
