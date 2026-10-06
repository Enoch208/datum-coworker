import type { Currency, Money } from "./contract";

export type MoneyErrorCode =
  "MALFORMED_AMOUNT" | "AMOUNT_TOO_LARGE" | "NOT_MINOR_UNITS" | "CURRENCY_MISMATCH";

export class MoneyError extends Error {
  readonly code: MoneyErrorCode;

  constructor(code: MoneyErrorCode, message: string) {
    super(message);
    this.name = "MoneyError";
    this.code = code;
  }
}

const moneyTextPattern = /^(0|[1-9][0-9]*)(?:\.([0-9]{1,2}))?$/;

const minorUnitsFromText = (text: string): number | MoneyErrorCode => {
  const match = moneyTextPattern.exec(text);
  if (match === null) return "MALFORMED_AMOUNT";
  const whole = match[1] ?? "";
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const minor = Number(whole + fraction);
  return Number.isSafeInteger(minor) ? minor : "AMOUNT_TOO_LARGE";
};

export const isMoneyText = (text: string): boolean => typeof minorUnitsFromText(text) === "number";

export const parseMoney = (text: string, currency: Currency): Money => {
  const minor = minorUnitsFromText(text);
  if (typeof minor === "number") return { amountMinor: minor, currency };
  throw new MoneyError(minor, `Not a valid ${currency} amount: ${JSON.stringify(text)}`);
};

const assertMinorUnits = (money: Money): void => {
  if (!Number.isSafeInteger(money.amountMinor)) {
    throw new MoneyError(
      "NOT_MINOR_UNITS",
      `Amount is not whole minor units: ${String(money.amountMinor)}`,
    );
  }
};

const assertSameCurrency = (left: Money, right: Money): void => {
  const leftCurrency: string = left.currency;
  if (leftCurrency !== right.currency) {
    throw new MoneyError(
      "CURRENCY_MISMATCH",
      `Cannot combine ${left.currency} with ${right.currency}`,
    );
  }
};

const checkedPair = (left: Money, right: Money): void => {
  assertMinorUnits(left);
  assertMinorUnits(right);
  assertSameCurrency(left, right);
};

export const zeroMoney = (currency: Currency): Money => ({ amountMinor: 0, currency });

export const addMoney = (left: Money, right: Money): Money => {
  checkedPair(left, right);
  return { amountMinor: left.amountMinor + right.amountMinor, currency: left.currency };
};

export const subtractMoney = (left: Money, right: Money): Money => {
  checkedPair(left, right);
  return { amountMinor: left.amountMinor - right.amountMinor, currency: left.currency };
};

export const sumMoney = (items: readonly Money[], currency: Currency): Money =>
  items.reduce(addMoney, zeroMoney(currency));

export const compareMoney = (left: Money, right: Money): -1 | 0 | 1 => {
  checkedPair(left, right);
  if (left.amountMinor < right.amountMinor) return -1;
  return left.amountMinor > right.amountMinor ? 1 : 0;
};

export const formatMoney = (money: Money): string => {
  assertMinorUnits(money);
  const digits = String(Math.abs(money.amountMinor)).padStart(3, "0");
  const sign = money.amountMinor < 0 ? "-" : "";
  return `${sign}${money.currency} ${digits.slice(0, -2)}.${digits.slice(-2)}`;
};
