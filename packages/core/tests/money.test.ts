import { describe, expect, it } from "vitest";
import type { Money } from "../src/contract";
import {
  addMoney,
  compareMoney,
  formatMoney,
  fromWireMoney,
  isMoneyText,
  MoneyError,
  moneyText,
  parseMoney,
  subtractMoney,
  sumMoney,
  toWireMoney,
  zeroMoney,
  evenShare,
} from "../src/money";

const sgd = (amountMinor: number): Money => ({ amountMinor, currency: "SGD" });
const mislabelled = (currency: string): Money => Object.assign(sgd(100), { currency });

describe("parseMoney", () => {
  it("parses a two-decimal SGD string into minor units", () => {
    expect(parseMoney("37.80", "SGD")).toEqual({ amountMinor: 3780, currency: "SGD" });
  });

  it("parses whole and one-decimal amounts", () => {
    expect(parseMoney("50", "SGD")).toEqual(sgd(5000));
    expect(parseMoney("8.2", "SGD")).toEqual(sgd(820));
    expect(parseMoney("0", "SGD")).toEqual(sgd(0));
    expect(parseMoney("0.05", "SGD")).toEqual(sgd(5));
  });

  it("keeps values that floats would corrupt exact", () => {
    expect(parseMoney("0.29", "SGD")).toEqual(sgd(29));
    expect(parseMoney("1.15", "SGD")).toEqual(sgd(115));
    expect(parseMoney("4.35", "SGD")).toEqual(sgd(435));
  });

  it.each([
    "37.805",
    "-1.00",
    "-0",
    "1e3",
    "abc",
    "",
    " 37.80",
    "37.80 ",
    "37.",
    ".80",
    "05",
    "00.50",
    "37,80",
    "+3",
    "0x10",
    "NaN",
    "Infinity",
    "1.2.3",
  ])("rejects %j", (text) => {
    expect(() => parseMoney(text, "SGD")).toThrow(MoneyError);
    expect(isMoneyText(text)).toBe(false);
  });

  it("rejects amounts beyond safe integer minor units", () => {
    expect(() => parseMoney("90071992547409.92", "SGD")).toThrow(MoneyError);
    expect(isMoneyText("90071992547409.91")).toBe(true);
  });

  it("reports the failure as a typed code", () => {
    expect(() => parseMoney("37.805", "SGD")).toThrow(
      expect.objectContaining({ code: "MALFORMED_AMOUNT" }),
    );
    expect(() => parseMoney("90071992547409.92", "SGD")).toThrow(
      expect.objectContaining({ code: "AMOUNT_TOO_LARGE" }),
    );
  });
});

describe("formatMoney", () => {
  it("formats with the currency code, never S$", () => {
    expect(formatMoney(sgd(3780))).toBe("SGD 37.80");
    expect(formatMoney(sgd(5000))).toBe("SGD 50.00");
    expect(formatMoney(sgd(5))).toBe("SGD 0.05");
    expect(formatMoney(sgd(0))).toBe("SGD 0.00");
  });

  it("formats an overrun with a leading minus", () => {
    expect(formatMoney(sgd(-120))).toBe("-SGD 1.20");
  });

  it("round-trips through parseMoney", () => {
    expect(formatMoney(parseMoney("1234.5", "SGD"))).toBe("SGD 1234.50");
  });

  it("refuses fractional minor units", () => {
    expect(() => formatMoney(sgd(37.8))).toThrow(MoneyError);
  });
});

describe("money arithmetic", () => {
  it("adds and subtracts in minor units", () => {
    expect(addMoney(sgd(1380), sgd(2000))).toEqual(sgd(3380));
    expect(subtractMoney(sgd(5000), sgd(4180))).toEqual(sgd(820));
  });

  it("lets a subtraction go negative so an overrun stays visible", () => {
    expect(subtractMoney(sgd(5000), sgd(5100))).toEqual(sgd(-100));
  });

  it("sums the spec ledger to SGD 41.80", () => {
    expect(sumMoney([sgd(1380), sgd(2000), sgd(800)], "SGD")).toEqual(sgd(4180));
  });

  it("sums an empty list to zero in the given currency", () => {
    expect(sumMoney([], "SGD")).toEqual(zeroMoney("SGD"));
  });

  it("compares amounts of one currency", () => {
    expect(compareMoney(sgd(4180), sgd(5000))).toBe(-1);
    expect(compareMoney(sgd(5000), sgd(5000))).toBe(0);
    expect(compareMoney(sgd(5100), sgd(5000))).toBe(1);
  });

  it("refuses to mix currencies", () => {
    const usd = mislabelled("USD");
    expect(() => addMoney(sgd(100), usd)).toThrow(
      expect.objectContaining({ code: "CURRENCY_MISMATCH" }),
    );
    expect(() => subtractMoney(sgd(100), usd)).toThrow(MoneyError);
    expect(() => compareMoney(sgd(100), usd)).toThrow(MoneyError);
    expect(() => sumMoney([usd], "SGD")).toThrow(MoneyError);
  });

  it("refuses fractional minor units in arithmetic", () => {
    expect(() => addMoney(sgd(0.1), sgd(0.2))).toThrow(MoneyError);
  });
});

describe("wire money", () => {
  it("writes minor units as a two-decimal string without the currency", () => {
    expect(moneyText(sgd(5000))).toBe("50.00");
    expect(moneyText(sgd(5))).toBe("0.05");
    expect(moneyText(sgd(-120))).toBe("-1.20");
  });

  it("converts to and from the wire shape exactly", () => {
    expect(toWireMoney(sgd(3780))).toEqual({ amount: "37.80", currency: "SGD" });
    expect(fromWireMoney({ amount: "37.80", currency: "SGD" })).toEqual(sgd(3780));
    expect(fromWireMoney(toWireMoney(sgd(123_456_789)))).toEqual(sgd(123_456_789));
  });

  it("refuses a malformed wire amount", () => {
    expect(() => fromWireMoney({ amount: "37.805", currency: "SGD" })).toThrow(MoneyError);
  });
});

describe("evenShare", () => {
  it("splits a trip's cost into equal per-spot shares", () => {
    expect(evenShare({ amountMinor: 1_500, currency: "SGD" }, 3)).toEqual({
      amountMinor: 500,
      currency: "SGD",
    });
  });

  it("refuses a split that would need fractions of a cent", () => {
    expect(() => evenShare({ amountMinor: 1_000, currency: "SGD" }, 3)).toThrow(RangeError);
    expect(() => evenShare({ amountMinor: 1_000, currency: "SGD" }, 0)).toThrow(RangeError);
  });
});
