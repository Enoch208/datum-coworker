import { describe, expect, it } from "vitest";
import type { CampaignReceipt, Money } from "../src/contract";
import { evaluateEvidence, type EvidenceContext, type EvidenceSubmission } from "../src/evidence";
import { decideExpense, type ReceiptReading } from "../src/expense";
import type { UnresolvedRequirement } from "../src/goal";
import { recoveryKey } from "../src/recovery";
import {
  validateRemediation,
  type RemediationAction,
  type RemediationAuthority,
} from "../src/remediation";
import { settlementVerdict } from "../src/settlement";

const sgd = (amountMinor: number): Money => ({ amountMinor, currency: "SGD" });
const campaignId = "cmp_7k2m9q4w8z1x3c5v";
const copy = { headline: "Datum is live at TOKEN2049", subcopy: "Scan to see what it shipped" };
const missedC: UnresolvedRequirement = {
  spotCode: "C",
  reason: { kind: "TASK_ENDED", failure: "TASK_EXPIRED" },
};

const authority: RemediationAuthority = {
  campaignId,
  approvedSpotCodes: ["A", "B", "C", "D"],
  unresolved: [missedC],
  approvedAssetVersion: 1,
  approvedCopy: copy,
  budget: {
    approvedBudget: sgd(5000),
    expenses: [{ amount: sgd(3380), status: "CONFIRMED" }],
    committedOpenSpend: sgd(0),
  },
  deadline: "2026-10-07T17:00:00+08:00",
  now: "2026-10-07T16:13:00+08:00",
  tasks: ["A", "B", "C", "D"].map((spotCode) => ({
    idempotencyKey: recoveryKey(campaignId, spotCode, 1),
    spotCodes: [spotCode],
    open: false,
  })),
};

const trip = (overrides: Partial<RemediationAction> = {}): RemediationAction => ({
  spotCodes: ["C"],
  assetVersion: 1,
  publicCopy: null,
  estimatedCost: sgd(800),
  dueBy: "2026-10-07T16:45:00+08:00",
  ...overrides,
});

const proposes = (action: RemediationAction, against = authority) =>
  validateRemediation({ actions: [action] }, against);

const baseUrl = "https://datum.example";
const evidenceContext: EvidenceContext = {
  expected: { campaignId, spotCode: "C" },
  qrBaseUrl: baseUrl,
  taskDueBy: "2026-10-07T16:45:00+08:00",
  campaignDeadline: "2026-10-07T17:00:00+08:00",
  taskCancelled: false,
  taskExpired: false,
};
const photo = (overrides: Partial<EvidenceSubmission> = {}): EvidenceSubmission => ({
  photoPresent: true,
  decodedQrText: `${baseUrl}/c/${campaignId}/C`,
  submittedAt: "2026-10-07T16:38:00+08:00",
  belongsToOpenTask: true,
  ...overrides,
});

const reading = (overrides: Partial<ReceiptReading> = {}): ReceiptReading => ({
  readable: true,
  isPurchaseReceipt: true,
  total: "8.00",
  currency: "SGD",
  merchant: "PRINT HUB PTE LTD",
  concerns: [],
  ...overrides,
});

describe("the model proposes, but cannot grant itself authority", () => {
  it("cannot spend past the approved budget: a SGD 500 fix stops for the customer", () => {
    const verdict = proposes(trip({ estimatedCost: sgd(50_000) }));
    expect(verdict).toMatchObject({ outcome: "NEEDS_APPROVAL", shortfall: sgd(48_380) });
  });

  it("cannot act at a spot the customer never approved", () => {
    expect(proposes(trip({ spotCodes: ["Z"] }))).toMatchObject({
      outcome: "REJECTED",
      reason: "SPOT_NOT_APPROVED",
    });
  });

  it("cannot swap in a different card or rewrite the approved copy", () => {
    expect(proposes(trip({ assetVersion: 2 }))).toMatchObject({ reason: "ASSET_NOT_APPROVED" });
    expect(
      proposes(trip({ publicCopy: { ...copy, headline: "Free money, scan now" } })),
    ).toMatchObject({ reason: "COPY_CHANGED" });
  });

  it("cannot schedule work past the deadline, or act at all once it has passed", () => {
    expect(proposes(trip({ dueBy: "2026-10-07T17:30:00+08:00" }))).toMatchObject({
      reason: "DUE_AFTER_DEADLINE",
    });
    expect(proposes(trip(), { ...authority, now: "2026-10-07T17:01:00+08:00" })).toEqual({
      outcome: "EXPIRED",
    });
  });

  it("cannot redo a spot that already passed", () => {
    expect(proposes(trip({ spotCodes: ["A"] }))).toMatchObject({ reason: "SPOT_NOT_UNRESOLVED" });
  });

  it("cannot exceed what is left: SGD 16.20 fits, SGD 16.21 stops for the customer", () => {
    const generous = trip({ estimatedCost: sgd(1_620) });
    const greedy = trip({ estimatedCost: sgd(1_621) });
    expect(proposes(generous).outcome).toBe("ACCEPTED");
    expect(proposes(greedy).outcome).toBe("NEEDS_APPROVAL");
  });
});

describe("a runner cannot claim a spot is live without proof", () => {
  it("fails a photo with no readable code, whatever the runner says about it", () => {
    expect(evaluateEvidence(photo({ decodedQrText: null }), evidenceContext)).toMatchObject({
      verdict: "FAIL",
      failure: "QR_NOT_FOUND",
    });
  });

  it("fails another spot's card photographed for this spot", () => {
    const wrong = photo({ decodedQrText: `${baseUrl}/c/${campaignId}/B` });
    expect(evaluateEvidence(wrong, evidenceContext)).toMatchObject({ failure: "QR_WRONG_SPOT" });
  });

  it("fails a photo sent outside the open task", () => {
    expect(evaluateEvidence(photo({ belongsToOpenTask: false }), evidenceContext)).toMatchObject({
      failure: "NO_EVIDENCE",
    });
  });

  it("fails a photo sent after the deadline, even with the right code", () => {
    const late = photo({ submittedAt: "2026-10-07T17:05:00+08:00" });
    expect(evaluateEvidence(late, evidenceContext)).toMatchObject({ failure: "LATE_EVIDENCE" });
  });
});

describe("money counts only when a receipt backs it", () => {
  it("does not confirm an amount higher than the receipt shows", () => {
    expect(decideExpense(sgd(2_000), { kind: "READ", reading: reading() }).status).toBe("DISPUTED");
  });

  it("does not confirm a photo the reader says is not a purchase receipt", () => {
    const flyer = reading({ isPurchaseReceipt: false, concerns: ["Promotional flyer"] });
    expect(decideExpense(sgd(800), { kind: "READ", reading: flyer }).status).toBe("DISPUTED");
  });

  it("does not confirm anything when the reader could not check the receipt", () => {
    expect(decideExpense(sgd(800), { kind: "READER_FAILED", reason: "timeout" }).status).toBe(
      "DISPUTED",
    );
  });

  it("confirms only an amount that matches a clean purchase receipt", () => {
    expect(decideExpense(sgd(800), { kind: "READ", reading: reading() }).status).toBe("CONFIRMED");
  });
});

describe("nobody can get Datum paid for work it did not finish", () => {
  const unfinished: CampaignReceipt = {
    campaignId,
    campaignName: "Kopi Lab",
    status: "EXPIRED_INCOMPLETE",
    target: { spots: 4, deadline: "2026-10-07T17:00:00+08:00", budget: sgd(5000) },
    actual: { spotsPassed: 3, completedAt: null, spend: sgd(3380) },
    spots: [],
    firstPassPassed: 3,
    recoveryActions: 1,
    recoveries: [],
    postApprovalInterventions: 0,
    interventions: [],
    spendLines: [],
    executorAdapters: ["LOCAL_ENROLLED_RUNNER"],
    totalScans: 0,
    masumi: null,
  };

  it("refuses settlement for a campaign that ended with a spot still missing", () => {
    const sha = "a".repeat(64);
    expect(
      settlementVerdict({
        receipt: unfinished,
        recordedSha256: sha,
        computedSha256: sha,
        resultText: `Campaign Receipt sha256 ${sha}`,
      }),
    ).toEqual({ outcome: "REFUSE", reason: "NOT_COMPLETED" });
  });
});
