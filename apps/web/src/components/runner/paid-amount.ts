import { isMoneyText, moneyText, parseMoney, type MoneyText } from "@datum/core";

export type PaidAmount =
  | { readonly ok: true; readonly amount: MoneyText }
  | { readonly ok: false; readonly error: string };

export function readPaidAmount(raw: string): PaidAmount {
  const text = raw.trim().replace(",", ".");
  if (text.length === 0) return { ok: false, error: "Enter the total printed on the receipt." };
  if (!isMoneyText(text)) {
    return { ok: false, error: "Enter dollars and cents only, like 13.80." };
  }
  const money = parseMoney(text, "SGD");
  if (money.amountMinor === 0) return { ok: false, error: "The amount must be more than 0.00." };
  return { ok: true, amount: moneyText(money) };
}
