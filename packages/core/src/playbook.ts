import type { BrandPlaybook, Money } from "./contract";

export interface BrandPageFacts {
  finalUrl: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
}

export type BrandPageReading =
  | { outcome: "READ"; url: string; facts: BrandPageFacts }
  | { outcome: "NOT_GIVEN" }
  | { outcome: "FAILED"; url: string; reason: string };

export interface PlaybookSeed {
  brandId: string;
  brandName: string;
  website: string | null;
  message: string;
  budget: Money;
  page: BrandPageReading;
}

export const unsubstantiatedClaims = [
  "guaranteed",
  "risk-free",
  "#1",
  "number one",
  "best in Singapore",
  "cheapest in Singapore",
] as const;

const quoted = (text: string): string => `"${text}"`;

const pageNotes = (page: BrandPageReading): string[] => {
  if (page.outcome === "NOT_GIVEN") return ["No brand page was given."];
  if (page.outcome === "FAILED")
    return [`Brand page ${page.url} could not be read: ${page.reason}.`];
  const { title, description, imageUrl } = page.facts;
  return [
    `Brand page read from ${page.facts.finalUrl}.`,
    ...(title === null ? [] : [`Brand page title: ${quoted(title)}`]),
    ...(description === null ? [] : [`Brand page description: ${quoted(description)}`]),
    ...(imageUrl === null ? [] : [`Logo candidate from the brand page, not approved: ${imageUrl}`]),
  ];
};

export const draftPlaybook = (seed: PlaybookSeed): BrandPlaybook => ({
  brandId: seed.brandId,
  version: 1,
  name: seed.brandName,
  website: seed.website,
  approvedLogoUrl: null,
  approvedTagline: null,
  defaultPrintFormat: "A5",
  defaultEvidence: "photo_with_decodable_spot_qr",
  maxAutonomousPhysicalSpend: { ...seed.budget },
  forbiddenClaims: [...unsubstantiatedClaims],
  notes: [`First campaign message: ${quoted(seed.message)}`, ...pageNotes(seed.page)],
});

export const brandPageWarning = (page: BrandPageReading): string | null =>
  page.outcome === "FAILED"
    ? `Datum could not read ${page.url} (${page.reason}), so the Brand Playbook was drafted from the brand name and message only.`
    : null;
