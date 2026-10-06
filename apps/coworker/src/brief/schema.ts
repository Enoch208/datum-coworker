import { z } from "zod";

const briefSpot = z.strictObject({
  name: z
    .string()
    .describe("Where this card goes, in the customer's words, such as 'Amoy Street cafe window'"),
  instructions: z
    .string()
    .describe(
      "How to put the card up at this spot. Use the customer's words; if they gave none, write one short practical sentence from the spot itself. The customer reviews every spot before approving.",
    ),
});

export const briefOutputSchema = z.strictObject({
  brandName: z
    .string()
    .nullable()
    .describe(
      "The business or brand the campaign is for, as the customer wrote it; null if not stated",
    ),
  brandUrl: z
    .string()
    .nullable()
    .describe(
      "The brand's own website as a full https:// address if the customer gave one; null otherwise",
    ),
  message: z
    .string()
    .nullable()
    .describe(
      "What the printed card should tell people, in the customer's words, at most 280 characters; null if not stated",
    ),
  destinationUrl: z
    .string()
    .nullable()
    .describe("The full https:// address the QR code on each card should open; null if not stated"),
  spots: z
    .array(briefSpot)
    .describe("Every physical spot the customer named, in their order; empty if none"),
  deadline: z
    .string()
    .nullable()
    .describe(
      "When every card must be up, as ISO 8601 with a UTC offset such as 2026-10-08T18:00:00+08:00; null if no date and time can be read",
    ),
  budgetSgd: z
    .string()
    .nullable()
    .describe(
      "The total budget in Singapore dollars as a plain decimal such as 60.00; null if not stated or stated only in another currency",
    ),
});

export type BriefOutput = z.infer<typeof briefOutputSchema>;
