import { describe, expect, it } from "vitest";
import {
  brandPageWarning,
  draftPlaybook,
  unsubstantiatedClaims,
  type BrandPageReading,
  type PlaybookSeed,
} from "../src/playbook";

const seed = (page: BrandPageReading): PlaybookSeed => ({
  brandId: "brd_1",
  brandName: "Kopi Lab",
  website: "https://kopilab.example",
  message: "Show this card for a free oat flat white",
  budget: { amountMinor: 5_000, currency: "SGD" },
  page,
});

const read: BrandPageReading = {
  outcome: "READ",
  url: "https://kopilab.example",
  facts: {
    finalUrl: "https://kopilab.example/",
    title: "Kopi Lab | Specialty coffee",
    description: "Single-origin coffee on Amoy Street",
    imageUrl: "https://kopilab.example/og.png",
  },
};

describe("draftPlaybook", () => {
  it("drafts version 1 from the brand, the message and the brand page", () => {
    const playbook = draftPlaybook(seed(read));
    expect(playbook).toEqual({
      brandId: "brd_1",
      version: 1,
      name: "Kopi Lab",
      website: "https://kopilab.example",
      approvedLogoUrl: null,
      approvedTagline: null,
      defaultPrintFormat: "A5",
      defaultEvidence: "photo_with_decodable_spot_qr",
      maxAutonomousPhysicalSpend: { amountMinor: 5_000, currency: "SGD" },
      forbiddenClaims: [...unsubstantiatedClaims],
      notes: [
        'First campaign message: "Show this card for a free oat flat white"',
        "Brand page read from https://kopilab.example/.",
        'Brand page title: "Kopi Lab | Specialty coffee"',
        'Brand page description: "Single-origin coffee on Amoy Street"',
        "Logo candidate from the brand page, not approved: https://kopilab.example/og.png",
      ],
    });
  });

  it("never approves a logo or tagline on its own", () => {
    const playbook = draftPlaybook(seed(read));
    expect(playbook.approvedLogoUrl).toBeNull();
    expect(playbook.approvedTagline).toBeNull();
  });

  it("records a page it could not read and drafts without it", () => {
    const failed: BrandPageReading = {
      outcome: "FAILED",
      url: "https://kopilab.example",
      reason: "the page did not answer within 5 seconds",
    };
    expect(draftPlaybook(seed(failed)).notes).toEqual([
      'First campaign message: "Show this card for a free oat flat white"',
      "Brand page https://kopilab.example could not be read: the page did not answer within 5 seconds.",
    ]);
  });

  it("notes when no brand page was given", () => {
    expect(draftPlaybook(seed({ outcome: "NOT_GIVEN" })).notes).toContain(
      "No brand page was given.",
    );
  });

  it("does not share the budget object with its seed", () => {
    const input = seed(read);
    const playbook = draftPlaybook(input);
    expect(playbook.maxAutonomousPhysicalSpend).not.toBe(input.budget);
  });
});

describe("brandPageWarning", () => {
  it("warns the customer only when a given page failed", () => {
    expect(brandPageWarning(read)).toBeNull();
    expect(brandPageWarning({ outcome: "NOT_GIVEN" })).toBeNull();
    expect(
      brandPageWarning({ outcome: "FAILED", url: "https://x.example", reason: "it is not HTML" }),
    ).toBe(
      "Datum could not read https://x.example (it is not HTML), so the Brand Playbook was drafted from the brand name and message only.",
    );
  });
});
