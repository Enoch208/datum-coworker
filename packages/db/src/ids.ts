import { randomBytes } from "node:crypto";

const alphabet = "0123456789abcdefghjkmnpqrstvwxyz";
const suffixLength = 16;

export const idPrefixes = {
  brand: "brd",
  playbook: "pbk",
  campaign: "cmp",
  spot: "spt",
  approval: "apr",
  campaignAsset: "ast",
  auditEvent: "evt",
  scanEvent: "scn",
  physicalTask: "tsk",
  evidence: "evd",
  expense: "exp",
  masumiPayment: "pay",
} as const;

export type IdPrefix = (typeof idPrefixes)[keyof typeof idPrefixes];

export function newId(prefix: IdPrefix): string {
  const suffix = Array.from(randomBytes(suffixLength), (byte) =>
    alphabet.charAt(byte % alphabet.length),
  ).join("");
  return `${prefix}_${suffix}`;
}

const idShape = new RegExp(`^[a-z]{3}_[${alphabet}]{${String(suffixLength)}}$`);

export function hasIdShape(prefix: IdPrefix, value: string): boolean {
  return value.startsWith(`${prefix}_`) && idShape.test(value);
}
