import { createCampaignSchema, type CreateCampaignInput } from "@datum/api/campaign-service";
import type { z } from "zod";
import type { BriefOutput } from "./schema";

export type BriefCheck =
  | { readonly kind: "COMPLETE"; readonly input: CreateCampaignInput }
  | { readonly kind: "INCOMPLETE"; readonly missing: readonly string[] };

type Field = "brandName" | "message" | "destinationUrl" | "spots" | "deadline" | "budget";

const absentText: Readonly<Record<Field, string>> = {
  brandName: "The brand or business name to print on the card",
  message: "What the card should say to people who see it",
  destinationUrl: "The web address the QR code should open (a full https:// link)",
  spots: "Where the cards should go: at least one spot, and how to put the card up there",
  deadline: "The deadline: the date and time every card must be up",
  budget: "The total budget in SGD, for example SGD 60",
};

const invalidText: ReadonlyMap<string, string> = new Map([
  ["brandName", "The brand name must be at most 120 characters the card can print"],
  ["brandUrl", "The brand website must be a full http:// or https:// address"],
  ["message", "What the card says must be at most 280 characters"],
  ["destinationUrl", "The QR link must be a full http:// or https:// address"],
  ["spots", "Datum runs at most 26 spots in one campaign"],
  ["deadline", "The deadline must be a date and time with a time zone"],
  ["budget", "The budget must be an amount in SGD such as 60.00"],
]);

const fallback = (field: string, issue: z.core.$ZodIssue): string =>
  invalidText.get(field) ?? `${field}: ${issue.message}`;

const blank = (text: string | null): boolean => text === null || text.trim().length === 0;

const spotCode = (index: number): string => String.fromCharCode(65 + index);

const amountText = (text: string): string =>
  text
    .trim()
    .replace(/^(SGD|S\$|\$)\s*/i, "")
    .replace(/,/g, "");

function absentFields(brief: BriefOutput): Field[] {
  const absent: [boolean, Field][] = [
    [blank(brief.brandName), "brandName"],
    [blank(brief.message), "message"],
    [blank(brief.destinationUrl), "destinationUrl"],
    [brief.spots.length === 0, "spots"],
    [blank(brief.deadline), "deadline"],
    [blank(brief.budgetSgd), "budget"],
  ];
  return absent.filter(([missing]) => missing).map(([, field]) => field);
}

function spotProblem(brief: BriefOutput, issue: z.core.$ZodIssue): string {
  const index = issue.path[1];
  if (typeof index !== "number") return fallback("spots", issue);
  const spot = brief.spots[index];
  const label = `Spot ${spotCode(index)} (${spot?.name.trim() || "unnamed"})`;
  return issue.path[2] === "instructions"
    ? `${label} needs one sentence on how to put the card up, at most 1000 characters`
    : `${label} needs a name of at most 120 characters`;
}

function describe(brief: BriefOutput, issue: z.core.$ZodIssue): string {
  const field = String(issue.path[0]);
  if (field === "spots" && issue.path.length > 1) return spotProblem(brief, issue);
  if (issue.code === "custom") return issue.message;
  return fallback(field, issue);
}

export function checkBrief(brief: BriefOutput): BriefCheck {
  const absent = absentFields(brief);
  const parsed = createCampaignSchema.safeParse({
    brandName: brief.brandName ?? "",
    brandUrl: blank(brief.brandUrl) ? null : brief.brandUrl,
    message: brief.message ?? "",
    destinationUrl: brief.destinationUrl ?? "",
    spots: brief.spots.map((spot, index) => ({
      code: spotCode(index),
      name: spot.name,
      instructions: spot.instructions,
    })),
    deadline: brief.deadline ?? "",
    budget: { amount: amountText(brief.budgetSgd ?? ""), currency: "SGD" },
  });
  if (parsed.success && absent.length === 0) return { kind: "COMPLETE", input: parsed.data };
  const invalid = parsed.success
    ? []
    : parsed.error.issues
        .filter((issue) => !absent.some((field) => field === String(issue.path[0])))
        .map((issue) => describe(brief, issue));
  const missing = [...new Set([...absent.map((field) => absentText[field]), ...invalid])];
  return { kind: "INCOMPLETE", missing };
}
