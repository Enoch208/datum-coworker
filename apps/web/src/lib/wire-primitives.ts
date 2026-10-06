import { currencies, isMoneyText, type WireMoney } from "@datum/core";
import { z } from "zod";

export const instant = z.iso.datetime({ offset: true });

const isSignedMoneyText = (text: string): boolean =>
  isMoneyText(text.startsWith("-") ? text.slice(1) : text);

export const wireMoney: z.ZodType<WireMoney> = z.object({
  amount: z.string().refine(isSignedMoneyText, "Not a decimal money amount"),
  currency: z.enum(currencies),
});
