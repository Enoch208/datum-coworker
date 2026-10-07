import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { ownerStatementText, type OwnerStatement } from "@datum/core";

export interface TestOwner {
  readonly key: string;
  readonly privateKey: KeyObject;
}

export function newTestOwner(): TestOwner {
  const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return {
    key: pair.publicKey.export({ format: "der", type: "spki" }).toString("base64url"),
    privateKey: pair.privateKey,
  };
}

export const testOwner = newTestOwner();

export const ownerSign = (statement: OwnerStatement, owner: TestOwner = testOwner): string =>
  sign("sha256", Buffer.from(ownerStatementText(statement), "utf8"), {
    key: owner.privateKey,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
