import {
  campaignBudgetLimit,
  currencies,
  formatMoney,
  fromWireMoney,
  isMoneyText,
  isSpotCode,
  isWithinCampaignBudgetLimit,
  type AcceptExpenseRequest,
  type ApproveCampaignRequest,
  type CreateCampaignRequest,
  type EditCopyRequest,
  type RaiseBudgetRequest,
  type SpotDraft,
  type WireMoney,
} from "@datum/core";
import { z } from "zod";
import { unprintableCharacters } from "../cards/fonts";

const text = (max: number) => z.string().trim().min(1).max(max);
const httpUrl = z.url({ protocol: /^https?$/ }).max(2000);

const spotSchema = z.strictObject({
  code: z.string().refine(isSpotCode, "A spot code is 1 to 4 uppercase letters or digits"),
  name: text(120),
  instructions: text(1000),
}) satisfies z.ZodType<unknown, SpotDraft>;

const wireMoneySchema = z.strictObject({
  amount: z.string().refine(isMoneyText, "An amount is a decimal string such as 50.00"),
  currency: z.enum(currencies),
}) satisfies z.ZodType<unknown, WireMoney>;

const budgetSchema = wireMoneySchema
  .transform(fromWireMoney)
  .refine((money) => money.amountMinor > 0, "The budget must be more than zero")
  .superRefine((money, ctx) => {
    if (!isWithinCampaignBudgetLimit(money)) {
      const limit = formatMoney(campaignBudgetLimit(money.currency));
      ctx.addIssue({ code: "custom", message: `The budget can be at most ${limit}` });
    }
  });

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

const printableName = text(120).refine(
  (name) => unprintableCharacters(name).length === 0,
  "The brand name uses characters the card font cannot print",
);

const ownerKey = z
  .string()
  .regex(/^[A-Za-z0-9_-]{100,140}$/, "The owner key must be a base64url P-256 public key");
const ownerSignature = z
  .string()
  .regex(/^[A-Za-z0-9_-]{86}$/, "The signature must be a base64url P-256 signature");

export const createCampaignSchema = z.strictObject({
  brandName: printableName,
  brandUrl: httpUrl.nullable(),
  message: text(280),
  destinationUrl: httpUrl,
  spots: spotsSchema,
  deadline: futureDeadline,
  budget: budgetSchema,
  ownerKey: ownerKey.exactOptional(),
}) satisfies z.ZodType<unknown, CreateCampaignRequest>;

export type CreateCampaignInput = z.output<typeof createCampaignSchema>;

const copyText = z.string().max(500);

export const editCopySchema = z.strictObject({
  copy: z.strictObject({ headline: copyText, subcopy: copyText }),
}) satisfies z.ZodType<unknown, EditCopyRequest>;

export const approveCampaignSchema = z.strictObject({
  assetVersion: z.int().positive(),
  approvedBy: text(120),
  signature: ownerSignature,
  ownerKey: ownerKey.exactOptional(),
}) satisfies z.ZodType<unknown, ApproveCampaignRequest>;

export const raiseBudgetSchema = z.strictObject({
  budget: budgetSchema,
  approvedBy: text(120),
  signature: ownerSignature,
}) satisfies z.ZodType<unknown, RaiseBudgetRequest>;

export const acceptExpenseSchema = z.strictObject({
  acceptedBy: text(120),
  reason: text(280),
  signature: ownerSignature,
}) satisfies z.ZodType<unknown, AcceptExpenseRequest>;
