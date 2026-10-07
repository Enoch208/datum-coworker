import { describe, expect, it } from "vitest";
import type { CampaignReceipt, SpotReceiptLine } from "../src/contract";
import { receiptBinding, settlementVerdict, type SettlementClaim } from "../src/settlement";

const sha = "bfa8a63d33b2d14580fe0ca3b9ccda7a084f6d7eb67cafc3e5d6013a0e1793bf";
const otherSha = "0".repeat(64);

const spot = (spotCode: string, final: SpotReceiptLine["final"] = "PASS"): SpotReceiptLine => ({
  spotCode,
  name: `Spot ${spotCode}`,
  firstPass: "PASS",
  final,
  attempts: 1,
  inducedMiss: false,
  scans: 0,
  evidencePhotoUrl: null,
  passedAt: final === "PASS" ? "2026-10-07T20:49:17+08:00" : null,
});

const completed: CampaignReceipt = {
  campaignId: "cmp_d1tmstsxkymtjp7n",
  campaignName: "CodeDecoders",
  status: "COMPLETED",
  target: {
    spots: 2,
    deadline: "2026-10-10T12:00:00+08:00",
    budget: { amountMinor: 10_000, currency: "SGD" },
  },
  actual: {
    spotsPassed: 2,
    completedAt: "2026-10-07T20:49:19+08:00",
    spend: { amountMinor: 1_050, currency: "SGD" },
  },
  spots: [spot("A"), spot("B")],
  firstPassPassed: 1,
  recoveryActions: 1,
  recoveries: [],
  postApprovalInterventions: 0,
  interventions: [],
  spendLines: [],
  executorAdapters: ["LOCAL_ENROLLED_RUNNER"],
  totalScans: 1,
  masumi: null,
};

const resultFor = (receiptSha: string): string =>
  `Datum campaign cmp_d1tmstsxkymtjp7n ended COMPLETED: 2 of 2 spots live. ${receiptBinding(receiptSha)}, exact bytes https://datum.test/api/campaigns/cmp_d1tmstsxkymtjp7n/receipt/canonical`;

const claim = (overrides: Partial<SettlementClaim> = {}): SettlementClaim => ({
  receipt: completed,
  recordedSha256: sha,
  computedSha256: sha,
  resultText: resultFor(sha),
  ...overrides,
});

describe("Datum is paid only for a verified, completed outcome", () => {
  it("settles a completed campaign whose every spot passed, within budget, with a bound result", () => {
    expect(settlementVerdict(claim())).toEqual({ outcome: "SETTLE" });
  });

  it("settles before any result exists, so the result can be produced from this receipt", () => {
    expect(settlementVerdict(claim({ resultText: null }))).toEqual({ outcome: "SETTLE" });
  });

  it.each(["EXPIRED_INCOMPLETE", "FAILED", "CANCELLED", "EXECUTING", "NEEDS_APPROVAL"] as const)(
    "refuses a %s campaign",
    (status) => {
      const receipt = { ...completed, status };
      expect(settlementVerdict(claim({ receipt }))).toEqual({
        outcome: "REFUSE",
        reason: "NOT_COMPLETED",
      });
    },
  );

  it("refuses when a required spot never passed, even if the status says COMPLETED", () => {
    const receipt = {
      ...completed,
      actual: { ...completed.actual, spotsPassed: 1 },
      spots: [spot("A"), spot("B", "MISS")],
    };
    expect(settlementVerdict(claim({ receipt }))).toEqual({
      outcome: "REFUSE",
      reason: "SPOTS_UNRESOLVED",
    });
  });

  it("refuses when the receipt lists fewer spots than the approval required", () => {
    const receipt = { ...completed, spots: [spot("A")] };
    expect(settlementVerdict(claim({ receipt }))).toMatchObject({ reason: "SPOTS_UNRESOLVED" });
  });

  it("refuses a campaign whose recorded cost went over the approved budget", () => {
    const receipt = {
      ...completed,
      actual: { ...completed.actual, spend: { amountMinor: 10_001, currency: "SGD" as const } },
    };
    expect(settlementVerdict(claim({ receipt }))).toEqual({
      outcome: "REFUSE",
      reason: "OVER_BUDGET",
    });
  });

  it("refuses when the stored receipt bytes no longer hash to the recorded SHA-256", () => {
    expect(settlementVerdict(claim({ computedSha256: otherSha }))).toEqual({
      outcome: "REFUSE",
      reason: "RECEIPT_ALTERED",
    });
  });

  it("refuses a result that names a different receipt", () => {
    expect(settlementVerdict(claim({ resultText: resultFor(otherSha) }))).toEqual({
      outcome: "REFUSE",
      reason: "RESULT_NOT_BOUND",
    });
  });

  it("refuses a result that names no receipt at all", () => {
    expect(settlementVerdict(claim({ resultText: "Campaign done, please pay" }))).toEqual({
      outcome: "REFUSE",
      reason: "RESULT_NOT_BOUND",
    });
  });

  it("checks the outcome before the hashes, so a failed campaign is refused for what it is", () => {
    const receipt = { ...completed, status: "EXPIRED_INCOMPLETE" as const };
    expect(settlementVerdict(claim({ receipt, computedSha256: otherSha }))).toMatchObject({
      reason: "NOT_COMPLETED",
    });
  });
});
