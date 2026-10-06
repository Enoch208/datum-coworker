import type { CampaignReceipt } from "@datum/core";
import { isAsciiSafeResult, mip004ResultHash, sokosumiResultHash } from "@datum/masumi";
import { describe, expect, it } from "vitest";
import { ranPhysicalWork, resultText } from "../src/result";

const receipt = (overrides: Partial<CampaignReceipt> = {}): CampaignReceipt => ({
  campaignId: "cmp_0123456789abcdef",
  campaignName: "Kopi Lab",
  status: "COMPLETED",
  target: {
    spots: 4,
    deadline: "2026-10-07T10:00:00.000Z",
    budget: { amountMinor: 6_000, currency: "SGD" },
  },
  actual: {
    spotsPassed: 4,
    completedAt: "2026-10-07T08:41:00.000Z",
    spend: { amountMinor: 3_780, currency: "SGD" },
  },
  spots: [],
  firstPassPassed: 3,
  recoveryActions: 1,
  recoveries: [],
  postApprovalInterventions: 0,
  interventions: [],
  spendLines: [],
  executorAdapters: ["LOCAL_ENROLLED_RUNNER"],
  totalScans: 7,
  masumi: null,
  ...overrides,
});

const sha256 = "c".repeat(64);
const nonce = "0123456789abcdef0123";

describe("the Task result is the Campaign Receipt in one line", () => {
  it("states the outcome, the receipt hash and where its exact bytes live", () => {
    const text = resultText({ receipt: receipt(), sha256 }, "https://usedatum.xyz");
    expect(text).toBe(
      `Datum campaign cmp_0123456789abcdef for Kopi Lab ended COMPLETED: 4 of 4 spots live with checked photo evidence (first pass 3 of 4, 1 recovery actions), confirmed spend SGD 37.80 of SGD 60.00, completed 2026-10-07 16:41 SGT, before the 2026-10-07 18:00 SGT deadline. Campaign Receipt sha256 ${sha256}, exact bytes https://usedatum.xyz/api/campaigns/cmp_0123456789abcdef/receipt/canonical, receipt page https://usedatum.xyz/campaigns/cmp_0123456789abcdef`,
    );
  });

  it("says plainly when the deadline passed with spots still missing", () => {
    const text = resultText(
      {
        receipt: receipt({
          status: "EXPIRED_INCOMPLETE",
          actual: {
            spotsPassed: 2,
            completedAt: null,
            spend: { amountMinor: 1_400, currency: "SGD" },
          },
        }),
        sha256,
      },
      "https://usedatum.xyz",
    );
    expect(text).toContain(
      "ended EXPIRED_INCOMPLETE: 2 of 4 spots live with checked photo evidence",
    );
    expect(text).toContain("the 2026-10-07 18:00 SGT deadline passed");
  });

  it("keeps the bytes ASCII-safe so both published result hash rules agree", () => {
    const text = resultText(
      { receipt: receipt({ campaignName: 'Kopi "Lab" \\ 咖啡\nCafé' }), sha256 },
      "https://usedatum.xyz",
    );
    expect(text).toContain("for Kopi Lab Caf ended");
    expect(isAsciiSafeResult(text)).toBe(true);
    expect(sokosumiResultHash(text, nonce)).toBe(mip004ResultHash(text, nonce));
  });

  it("counts a campaign as run only when physical work was commissioned", () => {
    expect(ranPhysicalWork(receipt())).toBe(true);
    expect(ranPhysicalWork(receipt({ executorAdapters: [] }))).toBe(false);
  });
});
