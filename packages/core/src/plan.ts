import type { PrintFormat, PublicCopy, SpotCode } from "./contract";
import type { PlanStepDraft } from "./estimate";

export const copyLimits = { headline: 48, subcopy: 120 } as const;
export const maxPrintQuantity = 1_000;

export interface PlanDraft {
  headline: string;
  subcopy: string;
  printFormat: PrintFormat;
  assumptions: string[];
  customerWarnings: string[];
  steps: PlanStepDraft[];
}

export interface PlanRules {
  spotCodes: readonly SpotCode[];
  forbiddenClaims: readonly string[];
}

export const planRejectionCodes = [
  "HEADLINE_EMPTY",
  "HEADLINE_TOO_LONG",
  "SUBCOPY_EMPTY",
  "SUBCOPY_TOO_LONG",
  "FORBIDDEN_CLAIM",
  "NO_PRINT_STEP",
  "EXTRA_PRINT_STEP",
  "PRINT_NOT_FIRST",
  "PRINT_QUANTITY_INVALID",
  "PRINT_QUANTITY_TOO_LOW",
  "UNKNOWN_SPOT",
  "SPOT_PLACED_TWICE",
  "SPOT_NOT_PLACED",
] as const;
export type PlanRejectionCode = (typeof planRejectionCodes)[number];

export interface PlanRejection {
  reason: PlanRejectionCode;
  detail: string;
}

const rejection = (reason: PlanRejectionCode, detail: string): PlanRejection => ({
  reason,
  detail,
});

const singleLine = (text: string): string => text.replace(/\s+/g, " ").trim();

export const normalizeCopy = (copy: PublicCopy): PublicCopy => ({
  headline: singleLine(copy.headline),
  subcopy: singleLine(copy.subcopy),
});

const wordCharacter = /[\p{L}\p{N}]/u;

const boundaryAt = (text: string, index: number, edge: string): boolean =>
  !wordCharacter.test(edge) || !wordCharacter.test(text.charAt(index));

const containsClaim = (text: string, claim: string): boolean => {
  const haystack = singleLine(text).toLowerCase();
  const needle = singleLine(claim).toLowerCase();
  if (needle.length === 0) return false;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) {
    const end = at + needle.length;
    if (
      boundaryAt(haystack, at - 1, needle.charAt(0)) &&
      boundaryAt(haystack, end, needle.charAt(needle.length - 1))
    ) {
      return true;
    }
  }
  return false;
};

const lengthRejection = (field: "headline" | "subcopy", text: string): PlanRejection | null => {
  const code = field === "headline" ? "HEADLINE" : "SUBCOPY";
  if (text.length === 0) return rejection(`${code}_EMPTY`, `The ${field} is empty`);
  const limit = copyLimits[field];
  if (text.length <= limit) return null;
  return rejection(
    `${code}_TOO_LONG`,
    `The ${field} has ${String(text.length)} characters; the card fits ${String(limit)}`,
  );
};

export const copyRejection = (
  copy: PublicCopy,
  forbiddenClaims: readonly string[],
): PlanRejection | null => {
  const tooLong =
    lengthRejection("headline", copy.headline) ?? lengthRejection("subcopy", copy.subcopy);
  if (tooLong !== null) return tooLong;
  const claim = forbiddenClaims.find(
    (forbidden) =>
      containsClaim(copy.headline, forbidden) || containsClaim(copy.subcopy, forbidden),
  );
  return claim === undefined
    ? null
    : rejection("FORBIDDEN_CLAIM", `The copy uses the forbidden claim "${claim}"`);
};

const printRejection = (
  steps: readonly PlanStepDraft[],
  spotCount: number,
): PlanRejection | null => {
  const prints = steps.filter((step) => step.type === "PRINT_AND_COLLECT");
  const [print] = prints;
  if (print === undefined) return rejection("NO_PRINT_STEP", "The plan never prints the cards");
  if (prints.length > 1) return rejection("EXTRA_PRINT_STEP", "The plan prints more than once");
  if (steps[0] !== print)
    return rejection("PRINT_NOT_FIRST", "The cards must be printed before placement");
  const { quantity } = print;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > maxPrintQuantity) {
    return rejection("PRINT_QUANTITY_INVALID", `Cannot print ${String(quantity)} copies`);
  }
  if (quantity >= spotCount) return null;
  return rejection(
    "PRINT_QUANTITY_TOO_LOW",
    `${String(quantity)} copies cannot cover ${String(spotCount)} spots`,
  );
};

const placementRejection = (
  steps: readonly PlanStepDraft[],
  spotCodes: readonly SpotCode[],
): PlanRejection | null => {
  const placed = new Set<SpotCode>();
  for (const step of steps) {
    if (step.type !== "PLACE_SPOT") continue;
    if (!spotCodes.includes(step.spotCode)) {
      return rejection("UNKNOWN_SPOT", `Spot ${step.spotCode} is not an approved spot`);
    }
    if (placed.has(step.spotCode)) {
      return rejection("SPOT_PLACED_TWICE", `Spot ${step.spotCode} is placed more than once`);
    }
    placed.add(step.spotCode);
  }
  const missing = spotCodes.find((spotCode) => !placed.has(spotCode));
  return missing === undefined
    ? null
    : rejection("SPOT_NOT_PLACED", `Spot ${missing} is never placed`);
};

export const validatePlanDraft = (draft: PlanDraft, rules: PlanRules): PlanRejection | null =>
  copyRejection({ headline: draft.headline, subcopy: draft.subcopy }, rules.forbiddenClaims) ??
  printRejection(draft.steps, rules.spotCodes.length) ??
  placementRejection(draft.steps, rules.spotCodes);
