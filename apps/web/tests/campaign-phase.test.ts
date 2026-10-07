import { campaignStatuses, type CampaignStatus } from "@datum/core";
import { describe, expect, it } from "vitest";
import { pollsWhile } from "../src/lib/campaign-phase";

const refreshed: readonly CampaignStatus[] = [
  "PLANNING",
  "APPROVED",
  "EXECUTING",
  "VERIFYING",
  "REMEDIATING",
  "NEEDS_APPROVAL",
];

describe("pollsWhile", () => {
  it.each(refreshed)("keeps refreshing a %s campaign", (status) => {
    expect(pollsWhile(status)).toBe(true);
  });

  it("stops refreshing every other status", () => {
    const quiet = campaignStatuses.filter((status) => !refreshed.includes(status));
    expect(quiet).toEqual([
      "DRAFT",
      "AWAITING_APPROVAL",
      "COMPLETED",
      "EXPIRED_INCOMPLETE",
      "FAILED",
      "CANCELLED",
    ]);
    for (const status of quiet) expect(pollsWhile(status)).toBe(false);
  });
});
