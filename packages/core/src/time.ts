import type { IsoTimestamp } from "./contract";

const isoInstantPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

const millisecondsPerMinute = 60_000;

export const toEpochMs = (instant: IsoTimestamp): number => {
  const epochMs = isoInstantPattern.test(instant) ? Date.parse(instant) : Number.NaN;
  if (Number.isNaN(epochMs)) {
    throw new RangeError(`Not an ISO instant with a timezone: ${JSON.stringify(instant)}`);
  }
  return epochMs;
};

export const isAfter = (instant: IsoTimestamp, reference: IsoTimestamp): boolean =>
  toEpochMs(instant) > toEpochMs(reference);

export const earlierOf = (first: IsoTimestamp, second: IsoTimestamp): IsoTimestamp =>
  isAfter(first, second) ? second : first;

export const minutesUntil = (now: IsoTimestamp, deadline: IsoTimestamp): number =>
  Math.max(0, Math.floor((toEpochMs(deadline) - toEpochMs(now)) / millisecondsPerMinute));
