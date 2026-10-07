import { createPublicKey, verify } from "node:crypto";
import { ownerStatementText, type ApproveStatement } from "@datum/core";
import { describe, expect, it } from "vitest";
import { newOwnerKey, signAsOwner } from "../src/lib/owner-key";

const statement: ApproveStatement = {
  action: "APPROVE",
  campaignId: "cmp_d1tmstsxkymtjp7n",
  assetVersion: 1,
  assetHash: "a".repeat(64),
  spotsHash: "b".repeat(64),
  copy: { headline: "Own your ledger.", subcopy: "Scan the QR code to see how." },
  budget: { amount: "100.00", currency: "SGD" },
  deadline: "2026-10-10T04:00:00.000Z",
  approvedBy: "Maadhav",
};

const serverAccepts = (publicKey: string, text: string, signature: string): boolean =>
  verify(
    "sha256",
    Buffer.from(text, "utf8"),
    {
      key: createPublicKey({
        key: Buffer.from(publicKey, "base64url"),
        format: "der",
        type: "spki",
      }),
      dsaEncoding: "ieee-p1363",
    },
    Buffer.from(signature, "base64url"),
  );

describe("the browser's owner signature", () => {
  it("is a P-256 key and signature the API verifies exactly as it does on the server", async () => {
    const owner = await newOwnerKey();
    const signature = await signAsOwner(owner.privateKey, statement);
    expect(owner.publicKey).toMatch(/^[A-Za-z0-9_-]{100,140}$/);
    expect(signature).toMatch(/^[A-Za-z0-9_-]{86}$/);
    expect(serverAccepts(owner.publicKey, ownerStatementText(statement), signature)).toBe(true);
  });

  it("does not verify for any other terms", async () => {
    const owner = await newOwnerKey();
    const signature = await signAsOwner(owner.privateKey, statement);
    const raised = { ...statement, budget: { amount: "500.00", currency: "SGD" as const } };
    expect(serverAccepts(owner.publicKey, ownerStatementText(raised), signature)).toBe(false);
  });
});
