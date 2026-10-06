import { currencies, type CampaignBrief, type Money, type SpotDraft } from "@datum/core";
import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const httpUrl = z.url({ protocol: /^https?$/ }).max(2000);

const spotSchema = z.strictObject({
  code: z.string().regex(/^[A-Z0-9]{1,8}$/, "A spot code is 1 to 8 uppercase letters or digits"),
  name: text(120),
  instructions: text(1000),
}) satisfies z.ZodType<unknown, SpotDraft>;

const moneySchema = z.strictObject({
  amountMinor: z.int().positive(),
  currency: z.enum(currencies),
}) satisfies z.ZodType<unknown, Money>;

const spotsSchema = z
  .array(spotSchema)
  .min(1)
  .max(26)
  .superRefine((spots, ctx) => {
    const seen = new Set<string>();
    spots.forEach((spot, index) => {
      if (seen.has(spot.code)) {
        ctx.addIssue({
          code: "custom",
          message: `Spot code ${spot.code} is used more than once`,
          path: [index, "code"],
        });
      }
      seen.add(spot.code);
    });
  });

const futureDeadline = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .refine((deadline) => deadline.getTime() > Date.now(), "The deadline must be in the future");

export const createCampaignSchema = z.strictObject({
  brandName: text(120),
  brandUrl: httpUrl.nullable(),
  message: text(280),
  destinationUrl: httpUrl,
  spots: spotsSchema,
  deadline: futureDeadline,
  budget: moneySchema,
}) satisfies z.ZodType<unknown, CampaignBrief>;

export type CreateCampaignInput = z.output<typeof createCampaignSchema>;
