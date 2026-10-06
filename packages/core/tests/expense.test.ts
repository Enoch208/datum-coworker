import { describe, expect, it } from "vitest";
import type { Money } from "../src/contract";
import { decideExpense, type ReceiptReading } from "../src/expense";

const entered: Money = { amountMinor: 1_380, currency: "SGD" };

const reading = (overrides: Partial<ReceiptReading> = {}): ReceiptReading => ({
  readable: true,
  total: "13.80",
  currency: "SGD",
  merchant: "Print Hub",
  ...overrides,
});

const read = (overrides: Partial<ReceiptReading> = {}) =>
  decideExpense(entered, { kind: "READ", reading: reading(overrides) });

describe("decideExpense", () => {
  it("confirms only when the receipt total equals the entered amount", () => {
    expect(read()).toEqual({
      status: "CONFIRMED",
      explanation: "The receipt from Print Hub shows SGD 13.80, matching the entered SGD 13.80.",
    });
    expect(read({ total: "13.8", merchant: null }).status).toBe("CONFIRMED");
  });

  it("disputes a total that differs by a single cent and names both amounts", () => {
    expect(read({ total: "13.81" })).toEqual({
      status: "DISPUTED",
      explanation:
        "The receipt from Print Hub shows SGD 13.81, but SGD 13.80 was entered, so it needs review.",
    });
  });

  it("disputes a receipt in another currency", () => {
    expect(read({ currency: "myr" })).toMatchObject({
      status: "DISPUTED",
      explanation:
        "The receipt from Print Hub is in MYR 13.80, but SGD 13.80 was entered, so it needs review.",
    });
  });

  it.each([
    ["an unreadable receipt", { readable: false }],
    ["no total", { total: null }],
    ["a total that is not a plain amount", { total: "S$13.80" }],
    ["no currency", { currency: null }],
  ])("disputes %s", (_label, overrides) => {
    expect(read(overrides).status).toBe("DISPUTED");
  });

  it("leaves the amount SUBMITTED when no reader is set up or the reader failed", () => {
    expect(decideExpense(entered, { kind: "NO_READER" })).toEqual({
      status: "SUBMITTED",
      explanation: "No receipt reader is set up, so the entered SGD 13.80 waits for review.",
    });
    expect(decideExpense(entered, { kind: "READER_FAILED", reason: "timeout" })).toMatchObject({
      status: "SUBMITTED",
      explanation: expect.stringContaining("(timeout)") as unknown,
    });
  });

  it("never confirms an amount the runner did not enter", () => {
    const confirmed = read({ total: "99.00" });
    expect(confirmed.status).not.toBe("CONFIRMED");
  });
});
