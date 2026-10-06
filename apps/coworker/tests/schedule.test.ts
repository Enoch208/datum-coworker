import { minuteMs, mpsTimingViolations } from "@datum/masumi";
import { describe, expect, it } from "vitest";
import { campaignSchedule } from "../src/schedule";
import { classifyFailure } from "../src/failures";
import { HttpStatusError, TerminalLifecycleError } from "@datum/masumi";

const now = Date.parse("2026-10-07T02:00:00.000Z");

describe("the payment schedule for a campaign", () => {
  it("asks for the result 30 minutes after the campaign deadline", () => {
    const deadline = new Date(now + 6 * 60 * minuteMs);
    const schedule = campaignSchedule(now, deadline);
    expect(schedule).toEqual({
      payByTime: now + 12 * minuteMs,
      submitResultTime: deadline.getTime() + 30 * minuteMs,
      unlockTime: deadline.getTime() + 46 * minuteMs,
      externalDisputeUnlockTime: deadline.getTime() + 62 * minuteMs,
    });
    expect(mpsTimingViolations(schedule, now)).toEqual([]);
  });

  it("never asks for a result sooner than the proven 20 minutes after terms", () => {
    const schedule = campaignSchedule(now, new Date(now - 60 * minuteMs));
    expect(schedule.submitResultTime).toBe(now + 20 * minuteMs);
    expect(mpsTimingViolations(schedule, now)).toEqual([]);
  });

  it("meets every MPS minimum for deadlines from minutes to days away", () => {
    for (const minutes of [1, 14, 15, 60, 24 * 60, 7 * 24 * 60]) {
      const schedule = campaignSchedule(now, new Date(now + minutes * minuteMs));
      expect(mpsTimingViolations(schedule, now)).toEqual([]);
    }
  });
});

describe("classifying a failed step", () => {
  it("asks a person to approve a grant and retries the same Task", () => {
    const grant = new HttpStatusError("Sokosumi Core", 403, "Forbidden", "grant_required");
    const wrapped = new TerminalLifecycleError("Starting the Task was rejected.", { cause: grant });
    expect(classifyFailure(wrapped, false)).toEqual({
      kind: "NEEDS_HUMAN",
      action:
        "The Task owner must approve Datum's Vendor access request in their Personal Workspace notifications on Sokosumi. Datum retries this same Task after that.",
    });
    expect(classifyFailure(grant, true)).toMatchObject({
      kind: "NEEDS_HUMAN",
      action: expect.stringContaining("organization Workspace") as unknown,
    });
  });

  it("stops on a terminal lifecycle error and retries anything else", () => {
    expect(classifyFailure(new TerminalLifecycleError("Escrow did not lock"), false)).toEqual({
      kind: "STOP",
      reason: "Escrow did not lock",
    });
    expect(classifyFailure(new TypeError("fetch failed"), false)).toEqual({
      kind: "RETRY",
      reason: "fetch failed",
    });
  });
});
