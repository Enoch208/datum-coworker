import type { EvidenceFailure, UnresolvedReason } from "@datum/core";

const photoFailures: Readonly<Record<EvidenceFailure, string>> = {
  NO_EVIDENCE: "no photo for the open task arrived",
  QR_NOT_FOUND: "the last photo showed no readable spot code",
  QR_WRONG_CAMPAIGN: "the last photo showed another campaign's code",
  QR_WRONG_SPOT: "the last photo showed another spot's code",
  LATE_EVIDENCE: "the last photo arrived after the task was due",
  EXECUTOR_CANCELLED: "the task was cancelled",
  TASK_EXPIRED: "the task expired",
  ADVISORY_REVIEW_REQUIRED: "the last photo needs a person to review it",
};

export const reasonWords = (reason: UnresolvedReason): string => {
  switch (reason.kind) {
    case "NOT_COMMISSIONED":
      return "no placement has been commissioned yet";
    case "NO_EVIDENCE_YET":
      return "the placement is under way and no photo has arrived yet";
    case "EVIDENCE_FAILED":
      return `the placement is under way and ${photoFailures[reason.failure]}`;
    case "CLOSED_WITHOUT_PASS":
      return reason.lastFailure === null
        ? "no valid evidence before the task closed"
        : `no valid evidence before the task closed: ${photoFailures[reason.lastFailure]}`;
    case "TASK_ENDED":
      return reason.failure === "TASK_EXPIRED"
        ? "the task expired before valid evidence arrived"
        : "the task was cancelled before valid evidence arrived";
  }
};

export const gapWords = (reason: UnresolvedReason): string =>
  reason.kind === "CLOSED_WITHOUT_PASS"
    ? "no valid evidence before the task closed"
    : reasonWords(reason);
