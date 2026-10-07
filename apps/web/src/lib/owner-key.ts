import { ownerStatementText, type CampaignView, type OwnerStatement } from "@datum/core";

const algorithm = { name: "ECDSA", namedCurve: "P-256" } as const;
const signing = { name: "ECDSA", hash: "SHA-256" } as const;
const linkPrefix = "#owner=";

interface StoredOwner {
  readonly privateKey: string;
  readonly publicKey: string | null;
}

export interface OwnerSigner {
  readonly privateKey: string;
  readonly ownerKey?: string;
}

const storageKey = (campaignId: string): string => `datum.owner.${campaignId}`;

const toBase64Url = (bytes: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (text: string): ArrayBuffer => {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer;
};

export async function newOwnerKey(): Promise<StoredOwner & { readonly publicKey: string }> {
  const pair = await crypto.subtle.generateKey(algorithm, true, ["sign", "verify"]);
  return {
    publicKey: toBase64Url(await crypto.subtle.exportKey("spki", pair.publicKey)),
    privateKey: toBase64Url(await crypto.subtle.exportKey("pkcs8", pair.privateKey)),
  };
}

export const rememberOwner = (campaignId: string, owner: StoredOwner): void => {
  localStorage.setItem(storageKey(campaignId), JSON.stringify(owner));
};

const storedOwner = (campaignId: string): StoredOwner | null => {
  const raw = localStorage.getItem(storageKey(campaignId));
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || !("privateKey" in parsed)) return null;
  const { privateKey, publicKey } = parsed as { privateKey: unknown; publicKey?: unknown };
  if (typeof privateKey !== "string") return null;
  return { privateKey, publicKey: typeof publicKey === "string" ? publicKey : null };
};

export const ownerLinkHash = (privateKey: string): string => `${linkPrefix}${privateKey}`;

export function adoptOwnerLink(campaignId: string, hash: string): void {
  if (!hash.startsWith(linkPrefix) || storedOwner(campaignId) !== null) return;
  rememberOwner(campaignId, { privateKey: hash.slice(linkPrefix.length), publicKey: null });
}

export async function ownerSigner(campaign: CampaignView): Promise<OwnerSigner> {
  const stored = storedOwner(campaign.id);
  if (stored !== null) {
    return campaign.ownerKeyRegistered || stored.publicKey === null
      ? { privateKey: stored.privateKey }
      : { privateKey: stored.privateKey, ownerKey: stored.publicKey };
  }
  if (campaign.ownerKeyRegistered) {
    throw new Error(
      "Only this campaign's owner can do this. Open the private owner link it was created with, on this device.",
    );
  }
  const fresh = await newOwnerKey();
  rememberOwner(campaign.id, fresh);
  return { privateKey: fresh.privateKey, ownerKey: fresh.publicKey };
}

export async function signAsOwner(privateKey: string, statement: OwnerStatement): Promise<string> {
  const key = await crypto.subtle.importKey("pkcs8", fromBase64Url(privateKey), algorithm, false, [
    "sign",
  ]);
  const text = new TextEncoder().encode(ownerStatementText(statement));
  return toBase64Url(await crypto.subtle.sign(signing, key, text));
}
