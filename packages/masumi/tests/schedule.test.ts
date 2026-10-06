import { describe, expect, it } from "vitest";
import { minuteMs } from "../src/constants";
import {
  assertMpsTimingRules,
  buildSchedule,
  mpsTimingViolations,
  scheduleRequestTimes,
} from "../src/schedule";

const now = Date.parse("2026-10-06T02:21:58.062Z");

describe("Gate 0 payment schedule", () => {
  it("is payBy +12, submitResult +20, unlock +36, dispute +52 minutes", () => {
    expect(buildSchedule(now)).toEqual({
      payByTime: now + 12 * minuteMs,
      submitResultTime: now + 20 * minuteMs,
      unlockTime: now + 36 * minuteMs,
      externalDisputeUnlockTime: now + 52 * minuteMs,
    });
  });

  it("satisfies every MPS minimum rule at the moment it is built", () => {
    expect(mpsTimingViolations(buildSchedule(now), now)).toEqual([]);
    expect(() => {
      assertMpsTimingRules(buildSchedule(now), now);
    }).not.toThrow();
  });

  it("sends ISO instants that MPS echoes back as the same milliseconds", () => {
    const times = scheduleRequestTimes(buildSchedule(now));
    expect(times.unlockTime).toBe("2026-10-06T02:57:58.062Z");
    expect(Date.parse(times.payByTime)).toBe(now + 12 * minuteMs);
  });

  it("is rejected once it has gone stale", () => {
    expect(mpsTimingViolations(buildSchedule(now), now + 6 * minuteMs)).toEqual([
      "submitResultTime must be at least 15 min ahead",
    ]);
    expect(mpsTimingViolations(buildSchedule(now), now + 18 * minuteMs)).toEqual([
      "payByTime must not be more than 5 min ago",
      "submitResultTime must be at least 15 min ahead",
    ]);
  });

  it.each([
    [
      { payByTime: now + 16 * minuteMs },
      "payByTime must be at least 5 min before submitResultTime",
    ],
    [
      { unlockTime: now + 34 * minuteMs },
      "unlockTime must be at least 15 min after submitResultTime",
    ],
    [
      { externalDisputeUnlockTime: now + 50 * minuteMs },
      "externalDisputeUnlockTime must be at least 15 min after unlockTime",
    ],
  ])("names the broken rule for %j", (change, rule) => {
    const schedule = { ...buildSchedule(now), ...change };
    expect(mpsTimingViolations(schedule, now)).toEqual([rule]);
    expect(() => {
      assertMpsTimingRules(schedule, now);
    }).toThrow(rule);
  });
});
