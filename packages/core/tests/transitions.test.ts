import { describe, expect, it } from "vitest";
import {
  campaignStatuses,
  finalCampaignStatuses,
  goalLoopStopStatuses,
  type CampaignStatus,
} from "../src/contract";
import {
  assertTransition,
  campaignTransitions,
  canTransition,
  isFinalStatus,
  TransitionError,
} from "../src/transitions";

const nonFinal = campaignStatuses.filter((status) => !isFinalStatus(status));

describe("campaignTransitions", () => {
  it("has every campaign status as a key", () => {
    expect(Object.keys(campaignTransitions).sort()).toEqual([...campaignStatuses].sort());
  });

  it("gives the four final statuses no outgoing transitions", () => {
    expect([...finalCampaignStatuses].sort()).toEqual(
      ["CANCELLED", "COMPLETED", "EXPIRED_INCOMPLETE", "FAILED"].sort(),
    );
    for (const status of finalCampaignStatuses) {
      expect(campaignTransitions[status]).toEqual([]);
    }
  });

  it("lets every non-final status expire once the deadline passes", () => {
    for (const status of nonFinal) {
      expect(canTransition(status, "EXPIRED_INCOMPLETE")).toBe(true);
    }
  });

  it("lets every non-final status be cancelled, including after spend has started", () => {
    for (const status of nonFinal) {
      expect(canTransition(status, "CANCELLED")).toBe(true);
    }
  });

  it("makes every Goal Loop stop status reachable", () => {
    const targets = new Set(Object.values(campaignTransitions).flat());
    for (const status of goalLoopStopStatuses) {
      expect(targets.has(status)).toBe(true);
    }
  });

  it.each<[CampaignStatus, CampaignStatus]>([
    ["DRAFT", "PLANNING"],
    ["PLANNING", "AWAITING_APPROVAL"],
    ["AWAITING_APPROVAL", "APPROVED"],
    ["AWAITING_APPROVAL", "CANCELLED"],
    ["APPROVED", "EXECUTING"],
    ["APPROVED", "AWAITING_APPROVAL"],
    ["EXECUTING", "VERIFYING"],
    ["VERIFYING", "COMPLETED"],
    ["VERIFYING", "REMEDIATING"],
    ["VERIFYING", "EXECUTING"],
    ["REMEDIATING", "EXECUTING"],
    ["REMEDIATING", "NEEDS_APPROVAL"],
    ["REMEDIATING", "EXPIRED_INCOMPLETE"],
    ["NEEDS_APPROVAL", "EXECUTING"],
    ["NEEDS_APPROVAL", "CANCELLED"],
    ["NEEDS_APPROVAL", "EXPIRED_INCOMPLETE"],
    ["EXECUTING", "FAILED"],
  ])("allows %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => {
      assertTransition(from, to);
    }).not.toThrow();
  });

  it.each<[CampaignStatus, CampaignStatus]>([
    ["AWAITING_APPROVAL", "EXECUTING"],
    ["DRAFT", "APPROVED"],
    ["EXECUTING", "COMPLETED"],
    ["REMEDIATING", "COMPLETED"],
    ["NEEDS_APPROVAL", "COMPLETED"],
    ["NEEDS_APPROVAL", "APPROVED"],
    ["COMPLETED", "EXECUTING"],
    ["EXPIRED_INCOMPLETE", "COMPLETED"],
    ["CANCELLED", "PLANNING"],
    ["FAILED", "REMEDIATING"],
    ["EXECUTING", "EXECUTING"],
    ["EXECUTING", "AWAITING_APPROVAL"],
    ["VERIFYING", "AWAITING_APPROVAL"],
    ["NEEDS_APPROVAL", "AWAITING_APPROVAL"],
  ])("refuses %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => {
      assertTransition(from, to);
    }).toThrow(TransitionError);
  });

  it("sends an approved campaign back for approval only before execution starts", () => {
    const backToApproval = campaignStatuses.filter((status) =>
      canTransition(status, "AWAITING_APPROVAL"),
    );
    expect(backToApproval.sort()).toEqual(["APPROVED", "PLANNING"]);
  });

  it("names both statuses on a refused transition", () => {
    expect(() => {
      assertTransition("COMPLETED", "EXECUTING");
    }).toThrow(expect.objectContaining({ from: "COMPLETED", to: "EXECUTING" }));
  });
});
