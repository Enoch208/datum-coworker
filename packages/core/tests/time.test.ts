import { describe, expect, it } from "vitest";
import { earlierOf, isAfter, minutesUntil, toEpochMs } from "../src/time";

describe("toEpochMs", () => {
  it("reads an ISO instant with an offset", () => {
    expect(toEpochMs("2026-10-07T17:00:00+08:00")).toBe(Date.UTC(2026, 9, 7, 9, 0, 0));
  });

  it("reads UTC instants with and without fractional seconds", () => {
    expect(toEpochMs("2026-10-07T09:00:00Z")).toBe(Date.UTC(2026, 9, 7, 9, 0, 0));
    expect(toEpochMs("2026-10-07T09:00:00.250Z")).toBe(Date.UTC(2026, 9, 7, 9, 0, 0, 250));
  });

  it.each(["", "2026-10-07", "2026-10-07T17:00:00", "Oct 7 2026", "2026-13-40T99:00:00Z", "soon"])(
    "refuses %j because it is not an unambiguous instant",
    (text) => {
      expect(() => toEpochMs(text)).toThrow(RangeError);
    },
  );
});

describe("time comparisons", () => {
  it("compares instants across offsets", () => {
    expect(isAfter("2026-10-07T16:44:00+08:00", "2026-10-07T08:43:00Z")).toBe(true);
    expect(isAfter("2026-10-07T16:43:00+08:00", "2026-10-07T08:43:00Z")).toBe(false);
  });

  it("picks the earlier of two instants", () => {
    expect(earlierOf("2026-10-07T17:00:00+08:00", "2026-10-07T16:30:00+08:00")).toBe(
      "2026-10-07T16:30:00+08:00",
    );
  });

  it("counts whole minutes until a deadline and never goes below zero", () => {
    expect(minutesUntil("2026-10-07T16:13:00+08:00", "2026-10-07T17:00:00+08:00")).toBe(47);
    expect(minutesUntil("2026-10-07T16:59:30+08:00", "2026-10-07T17:00:00+08:00")).toBe(0);
    expect(minutesUntil("2026-10-07T17:05:00+08:00", "2026-10-07T17:00:00+08:00")).toBe(0);
  });
});
