import { minuteMs } from "./constants";

export interface PaymentSchedule {
  readonly payByTime: number;
  readonly submitResultTime: number;
  readonly unlockTime: number;
  readonly externalDisputeUnlockTime: number;
}

export const gate0ScheduleMinutes = {
  payBy: 12,
  submitResult: 20,
  unlock: 36,
  externalDisputeUnlock: 52,
} as const;

export const attachWindowMs = 5 * minuteMs;
export const submitWindowMs = 6 * minuteMs;
export const collectionEligibleAfterUnlockMs = 10 * minuteMs;
export const collectionOverdueAfterUnlockMs = 45 * minuteMs;

export function buildSchedule(nowMs: number): PaymentSchedule {
  return {
    payByTime: nowMs + gate0ScheduleMinutes.payBy * minuteMs,
    submitResultTime: nowMs + gate0ScheduleMinutes.submitResult * minuteMs,
    unlockTime: nowMs + gate0ScheduleMinutes.unlock * minuteMs,
    externalDisputeUnlockTime: nowMs + gate0ScheduleMinutes.externalDisputeUnlock * minuteMs,
  };
}

export function mpsTimingViolations(schedule: PaymentSchedule, nowMs: number): string[] {
  const gap = 15 * minuteMs;
  const rules: [boolean, string][] = [
    [schedule.payByTime >= nowMs - 5 * minuteMs, "payByTime must not be more than 5 min ago"],
    [
      schedule.payByTime <= schedule.submitResultTime - 5 * minuteMs,
      "payByTime must be at least 5 min before submitResultTime",
    ],
    [schedule.submitResultTime >= nowMs + gap, "submitResultTime must be at least 15 min ahead"],
    [
      schedule.unlockTime >= schedule.submitResultTime + gap,
      "unlockTime must be at least 15 min after submitResultTime",
    ],
    [
      schedule.externalDisputeUnlockTime >= schedule.unlockTime + gap,
      "externalDisputeUnlockTime must be at least 15 min after unlockTime",
    ],
  ];
  return rules.filter(([holds]) => !holds).map(([, rule]) => rule);
}

export function assertMpsTimingRules(schedule: PaymentSchedule, nowMs: number): void {
  const violations = mpsTimingViolations(schedule, nowMs);
  if (violations.length > 0) {
    throw new RangeError(`Payment schedule breaks MPS rules: ${violations.join("; ")}`);
  }
}

export function scheduleRequestTimes(schedule: PaymentSchedule) {
  return {
    payByTime: new Date(schedule.payByTime).toISOString(),
    submitResultTime: new Date(schedule.submitResultTime).toISOString(),
    unlockTime: new Date(schedule.unlockTime).toISOString(),
    externalDisputeUnlockTime: new Date(schedule.externalDisputeUnlockTime).toISOString(),
  };
}
