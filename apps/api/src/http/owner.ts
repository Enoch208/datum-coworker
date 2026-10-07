import { createPublicKey, verify, type KeyObject } from "node:crypto";
import { ownerStatementText, type OwnerStatement } from "@datum/core";
import type { CampaignRow } from "@datum/db";
import { HttpError } from "./errors";

const forbidden = (code: string, message: string): HttpError => new HttpError(403, code, message);

function ownerKeyObject(encoded: string): KeyObject {
  let key: KeyObject;
  try {
    key = createPublicKey({ key: Buffer.from(encoded, "base64url"), format: "der", type: "spki" });
  } catch {
    throw forbidden("OWNER_KEY_INVALID", "The owner key is not a valid P-256 public key");
  }
  if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
    throw forbidden("OWNER_KEY_INVALID", "The owner key must be an ECDSA P-256 public key");
  }
  return key;
}

export const assertOwnerKey = (encoded: string): string => {
  ownerKeyObject(encoded);
  return encoded;
};

export function signingKeyFor(campaign: CampaignRow, offered: string | undefined): string {
  if (campaign.ownerPublicKey !== null) {
    if (offered !== undefined && offered !== campaign.ownerPublicKey) {
      throw forbidden(
        "OWNER_KEY_MISMATCH",
        "This campaign is already bound to a different owner key",
      );
    }
    return campaign.ownerPublicKey;
  }
  if (offered === undefined) {
    throw forbidden(
      "OWNER_KEY_REQUIRED",
      "This campaign has no owner key yet; the first approval must register one",
    );
  }
  return assertOwnerKey(offered);
}

export function registeredOwnerKey(campaign: CampaignRow): string {
  if (campaign.ownerPublicKey === null) {
    throw forbidden(
      "OWNER_KEY_REQUIRED",
      "Only the campaign's owner can do this, and it has no owner key",
    );
  }
  return campaign.ownerPublicKey;
}

export function verifyOwnerSignature(
  encodedKey: string,
  statement: OwnerStatement,
  signature: string,
): string {
  const text = ownerStatementText(statement);
  const valid = verify(
    "sha256",
    Buffer.from(text, "utf8"),
    { key: ownerKeyObject(encodedKey), dsaEncoding: "ieee-p1363" },
    Buffer.from(signature, "base64url"),
  );
  if (!valid) {
    throw forbidden(
      "OWNER_SIGNATURE_INVALID",
      "The signature does not match this campaign's owner key and these exact terms",
    );
  }
  return text;
}
