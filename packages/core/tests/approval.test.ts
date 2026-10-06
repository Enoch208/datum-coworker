import { describe, expect, it } from "vitest";
import {
  assertExecutable,
  ExecutionBlockedError,
  isApprovalCurrent,
  isCopyEditable,
} from "../src/approval";
import { campaignStatuses, type ApprovalLock } from "../src/contract";

const approval: ApprovalLock = {
  campaignId: "cmp_7k2m9q4w8z1x3c5v",
  assetVersion: 2,
  assetHash: "a".repeat(64),
  spotsHash: "b".repeat(64),
  approvedCopy: { headline: "Free oat flat white", subcopy: "Show this card at Kopi Lab." },
  budget: { amountMinor: 5_000, currency: "SGD" },
  deadline: "2026-10-07T17:00:00+08:00",
  evidencePolicy: "photo_with_decodable_spot_qr",
  approvedBy: "Mei",
  approvedAt: "2026-10-06T10:00:00+08:00",
};

describe("assertExecutable", () => {
  it("lets execution start under an approval of the current asset version", () => {
    expect(assertExecutable(approval, 2)).toBe(approval);
    expect(isApprovalCurrent(approval, 2)).toBe(true);
  });

  it("blocks execution when nothing was approved", () => {
    expect(() => assertExecutable(null, 1)).toThrow(ExecutionBlockedError);
    expect(() => assertExecutable(null, 1)).toThrow(
      expect.objectContaining({ code: "NO_APPROVAL" }),
    );
  });

  it("blocks execution when the copy or card changed after approval", () => {
    expect(isApprovalCurrent(approval, 3)).toBe(false);
    expect(() => assertExecutable(approval, 3)).toThrow(
      expect.objectContaining({
        code: "APPROVAL_NOT_CURRENT",
        message: "The approval covers asset version 2, but version 3 is current",
      }),
    );
  });
});

describe("isCopyEditable", () => {
  it("allows a copy edit only while the campaign waits for or holds its approval", () => {
    expect(campaignStatuses.filter(isCopyEditable)).toEqual(["AWAITING_APPROVAL", "APPROVED"]);
  });

  it("locks the copy from execution onwards", () => {
    for (const status of [
      "EXECUTING",
      "VERIFYING",
      "REMEDIATING",
      "NEEDS_APPROVAL",
      "COMPLETED",
      "EXPIRED_INCOMPLETE",
      "FAILED",
      "CANCELLED",
    ] as const) {
      expect(isCopyEditable(status)).toBe(false);
    }
  });
});
