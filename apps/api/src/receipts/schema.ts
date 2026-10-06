import type { ReceiptReading } from "@datum/core";
import { z } from "zod";

export const receiptReadingSchema = z.strictObject({
  readable: z.boolean().describe("False when the photo is not a legible receipt"),
  total: z
    .string()
    .nullable()
    .describe(
      "The final total paid, exactly as printed, as a plain decimal with no symbol or separators, such as 13.80; null if it cannot be read",
    ),
  currency: z
    .string()
    .nullable()
    .describe(
      "ISO 4217 code of the total, such as SGD; a bare $ on a Singapore receipt is SGD; null if the receipt does not show it",
    ),
  merchant: z.string().nullable().describe("The shop name printed on the receipt, or null"),
}) satisfies z.ZodType<ReceiptReading>;
