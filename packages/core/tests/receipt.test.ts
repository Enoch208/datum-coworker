import { describe, expect, it } from "vitest";
import type { LedgerExpense } from "../src/budget";
import type {
  ApprovalLock,
  MasumiPaymentEvidence,
  Money,
  ReceiptIntervention,
  ReceiptRecovery,
  ReceiptSpendLine,
  SpotReceiptLine,
} from "../src/contract";
import { buildReceipt, ReceiptError, type ReceiptFacts } from "../src/receipt";

const sgd = (amountMinor: number): Money => ({ amountMinor, currency: "SGD" });
const confirmed = (amountMinor: number): LedgerExpense => ({
  amount: sgd(amountMinor),
  status: "CONFIRMED",
});
const campaignId = "cmp_7k2m9q4w8z1x3c5v";

const approval: ApprovalLock = {
  campaignId,
  assetVersion: 1,
  assetHash: "sha256:asset-v1",
  spotsHash: "sha256:spots-abcd",
  approvedCopy: { headline: "Free oat flat white", subcopy: "Show this card at Kopi Lab." },
  budget: sgd(5000),
  deadline: "2026-10-07T17:00:00+08:00",
  evidencePolicy: "photo_with_decodable_spot_qr",
  approvedBy: "buyer@datum.example",
  approvedAt: "2026-10-07T14:05:00+08:00",
};

const line = (
  spotCode: string,
  scans: number,
  overrides: Partial<SpotReceiptLine> = {},
): SpotReceiptLine => ({
  spotCode,
  name: `Spot ${spotCode}`,
  firstPass: "PASS",
  final: "PASS",
  attempts: 1,
  inducedMiss: false,
  scans,
  evidencePhotoUrl: `https://datum.example/evidence/${spotCode}.jpg`,
  passedAt: "2026-10-07T16:00:00+08:00",
  ...overrides,
});

const spendLines: ReceiptSpendLine[] = [
  { taskId: "tsk_print", kind: "RECEIPT", label: "Print Hub", amount: sgd(1380) },
  {
    taskId: "tsk_runner",
    kind: "AGREED_FEE",
    label: "Runner fee (agreed rate)",
    amount: sgd(2000),
  },
  { taskId: "tsk_c2", kind: "AGREED_FEE", label: "Runner fee (agreed rate)", amount: sgd(400) },
];

const recovery: ReceiptRecovery = {
  round: 1,
  source: "MODEL",
  idempotencyKey: `campaign:${campaignId}:spot:C:attempt:2`,
  spotCodes: ["C"],
  tasks: [{ spotCode: "C", attempt: 2, idempotencyKey: `campaign:${campaignId}:spot:C:attempt:2` }],
  estimatedCost: sgd(400),
  dispatchedAt: "2026-10-07T16:19:00+08:00",
};

const intervention = (at: string): ReceiptIntervention => ({
  at,
  actor: "CUSTOMER",
  actorName: "Mei Tan",
  action: "BUDGET_RAISED",
  reason: "raised the approved budget from SGD 50.00 to SGD 60.00",
});

const spotC = line("C", 2, { firstPass: "MISS", attempts: 2, inducedMiss: true });

const facts: ReceiptFacts = {
  campaignName: "Datum TOKEN2049 Launch",
  status: "COMPLETED",
  approval,
  spots: [line("A", 7), line("B", 3), spotC, line("D", 5)],
  expenses: [confirmed(1380), confirmed(2000), confirmed(400)],
  completedAt: "2026-10-07T16:43:00+08:00",
  adaptersUsed: ["LOCAL_ENROLLED_RUNNER"],
  firstApprovedAt: approval.approvedAt,
  interventions: [],
  recoveries: [recovery],
  spendLines,
  masumi: null,
};

const masumi: MasumiPaymentEvidence = {
  sokosumiTaskId: "task_1",
  paymentId: "pay_1",
  blockchainIdentifier: "bc_1",
  resultHash: "hash_1",
  sellerAddress: "addr_test1",
  tokenUnit: "tUSDM",
  collectionTxHash: null,
  netReceivedAtomic: null,
  collectionConfirmed: false,
  verifiedAt: null,
};

describe("buildReceipt", () => {
  it("derives the spec receipt: 4 of 4, SGD 37.80 of SGD 50, one recovery, 17 scans", () => {
    expect(buildReceipt(facts)).toEqual({
      campaignId,
      campaignName: "Datum TOKEN2049 Launch",
      status: "COMPLETED",
      target: { spots: 4, deadline: approval.deadline, budget: sgd(5000) },
      actual: { spotsPassed: 4, completedAt: "2026-10-07T16:43:00+08:00", spend: sgd(3780) },
      spots: facts.spots,
      firstPassPassed: 3,
      recoveryActions: 1,
      recoveries: [recovery],
      postApprovalInterventions: 0,
      interventions: [],
      spendLines,
      executorAdapters: ["LOCAL_ENROLLED_RUNNER"],
      totalScans: 17,
      masumi: null,
    });
  });

  it("counts spend from CONFIRMED expenses only", () => {
    const expenses = [...facts.expenses, { amount: sgd(900), status: "SUBMITTED" as const }];
    expect(buildReceipt({ ...facts, expenses }).actual.spend).toEqual(sgd(3780));
  });

  it("counts every attempt beyond a spot's first as a recovery action", () => {
    const spots = [
      line("A", 7),
      line("B", 3, { firstPass: "MISS", attempts: 3 }),
      spotC,
      line("D", 5),
    ];
    expect(buildReceipt({ ...facts, spots })).toMatchObject({
      recoveryActions: 3,
      firstPassPassed: 2,
    });
  });

  it("counts only interventions at or after the customer's first approval", () => {
    const interventions = [
      intervention("2026-10-07T13:00:00+08:00"),
      intervention(approval.approvedAt),
      intervention("2026-10-07T16:00:00+08:00"),
    ];
    const receipt = buildReceipt({ ...facts, interventions });
    expect(receipt.postApprovalInterventions).toBe(2);
    expect(receipt.interventions.map((item) => item.at)).toEqual([
      approval.approvedAt,
      "2026-10-07T16:00:00+08:00",
    ]);
  });

  it("refuses spend lines that do not add up to the confirmed spend", () => {
    expect(() => buildReceipt({ ...facts, spendLines: spendLines.slice(1) })).toThrow(
      expect.objectContaining({ code: "INCONSISTENT_SPEND" }),
    );
  });

  it("lists each adapter once, in contract order", () => {
    const adaptersUsed = ["RENTAHUMAN", "LOCAL_ENROLLED_RUNNER", "RENTAHUMAN"] as const;
    expect(buildReceipt({ ...facts, adaptersUsed }).executorAdapters).toEqual([
      "LOCAL_ENROLLED_RUNNER",
      "RENTAHUMAN",
    ]);
  });

  it("orders spot lines by spot code", () => {
    const spots = [line("D", 5), spotC, line("B", 3), line("A", 7)];
    expect(buildReceipt({ ...facts, spots }).spots.map((spot) => spot.spotCode)).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
  });

  it("copies the induced-miss flag for display without changing a single number", () => {
    const unflagged = buildReceipt({
      ...facts,
      spots: facts.spots.map((spot) => ({ ...spot, inducedMiss: false })),
    });
    const flagged = buildReceipt(facts);
    expect(flagged.spots.find((spot) => spot.spotCode === "C")?.inducedMiss).toBe(true);
    expect({ ...flagged, spots: [] }).toEqual({ ...unflagged, spots: [] });
  });

  it("reports an expired campaign with its passed and missing spots and no completion time", () => {
    const spots = [
      line("A", 7),
      line("B", 3),
      line("C", 0, { firstPass: "MISS", final: "MISS" }),
      line("D", 5),
    ];
    const receipt = buildReceipt({
      ...facts,
      status: "EXPIRED_INCOMPLETE",
      spots,
      completedAt: null,
    });
    expect(receipt.actual).toEqual({ spotsPassed: 3, completedAt: null, spend: sgd(3780) });
  });

  it.each<[string, Partial<ReceiptFacts>]>([
    ["a spot that did not pass", { spots: [line("A", 7), line("C", 0, { final: "MISS" })] }],
    ["no spots at all", { spots: [] }],
    ["no completion time", { completedAt: null }],
    ["a completion after the deadline", { completedAt: "2026-10-07T17:00:01+08:00" }],
    ["confirmed spend over budget", { expenses: [confirmed(5001)] }],
  ])("refuses to call a campaign COMPLETED with %s", (_label, overrides) => {
    expect(() => buildReceipt({ ...facts, ...overrides })).toThrow(
      expect.objectContaining({ code: "INCONSISTENT_COMPLETION" }),
    );
  });

  it("refuses a completion time on a campaign that did not complete", () => {
    expect(() => buildReceipt({ ...facts, status: "CANCELLED" })).toThrow(ReceiptError);
  });

  it("refuses a confirmed Masumi collection without a checked tx hash and verification time", () => {
    const unchecked = { ...masumi, collectionConfirmed: true };
    expect(() => buildReceipt({ ...facts, masumi: unchecked })).toThrow(
      expect.objectContaining({ code: "UNVERIFIED_COLLECTION" }),
    );
    const checked = {
      ...unchecked,
      collectionTxHash: "tx_1",
      verifiedAt: "2026-10-07T16:50:00+08:00",
    };
    expect(buildReceipt({ ...facts, masumi: checked }).masumi).toEqual(checked);
    expect(buildReceipt({ ...facts, masumi }).masumi).toEqual(masumi);
  });

  it.each([-1, 1.5, Number.NaN])("refuses a scan or attempt count of %d", (count) => {
    expect(() => buildReceipt({ ...facts, spots: [line("A", count)] })).toThrow(ReceiptError);
    expect(() => buildReceipt({ ...facts, spots: [line("A", 1, { attempts: count })] })).toThrow(
      ReceiptError,
    );
  });
});
