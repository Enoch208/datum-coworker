import { minuteMs, type PaymentSchedule } from "@datum/masumi";

const payByAfterTermsMinutes = 12;
const resultAfterDeadlineMinutes = 30;
const earliestResultAfterTermsMinutes = 20;
const unlockAfterResultMinutes = 16;
const disputeAfterUnlockMinutes = 16;

export function campaignSchedule(nowMs: number, deadline: Date): PaymentSchedule {
  const submitResultTime = Math.max(
    deadline.getTime() + resultAfterDeadlineMinutes * minuteMs,
    nowMs + earliestResultAfterTermsMinutes * minuteMs,
  );
  const unlockTime = submitResultTime + unlockAfterResultMinutes * minuteMs;
  return {
    payByTime: nowMs + payByAfterTermsMinutes * minuteMs,
    submitResultTime,
    unlockTime,
    externalDisputeUnlockTime: unlockTime + disputeAfterUnlockMinutes * minuteMs,
  };
}
