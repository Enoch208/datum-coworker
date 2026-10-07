import { describe, expect, it } from "vitest";
import type { Money } from "../src/contract";
import { decideExpense, type ReceiptReading } from "../src/expense";

const entered: Money = { amountMinor: 1_380, currency: "SGD" };

const reading = (overrides: Partial<ReceiptReading> = {}): ReceiptReading => ({
  readable: true,
  isPurchaseReceipt: true,
  total: "13.80",
  currency: "SGD",
  merchant: "Print Hub",
  concerns: [],
  ...overrides,
});

const read = (overrides: Partial<ReceiptReading> = {}) =>
  decideExpense(entered, { kind: "READ", reading: reading(overrides) });

describe("decideExpense", () => {
  it("confirms only when the amount read from a purchase receipt equals the entered amount", () => {
    expect(read()).toEqual({
      status: "CONFIRMED",
      explanation: "The amount read from the receipt from Print Hub matches the entered SGD 13.80.",
    });
    expect(read({ total: "13.8", merchant: null })).toEqual({
      status: "CONFIRMED",
      explanation: "The amount read from the receipt matches the entered SGD 13.80.",
    });
  });

  it("never claims the receipt itself was verified", () => {
    const { explanation } = read();
    expect(explanation).not.toMatch(/verif|authentic|genuine/i);
  });

  it("disputes a matching amount when the reader names a concern, and names it", () => {
    expect(read({ concerns: ['Printed "NOT A REAL PURCHASE"'] })).toEqual({
      status: "DISPUTED",
      explanation:
        'The receipt reader flagged this receipt (Printed "NOT A REAL PURCHASE"), so the entered SGD 13.80 needs review.',
    });
    expect(read({ concerns: ["No date", "Handwritten total"] }).explanation).toBe(
      "The receipt reader flagged this receipt (No date; Handwritten total), so the entered SGD 13.80 needs review.",
    );
  });

  it("disputes a matching amount on an image that is not a purchase receipt", () => {
    expect(read({ isPurchaseReceipt: false })).toEqual({
      status: "DISPUTED",
      explanation:
        "The receipt reader says this image is not a purchase receipt, so the entered SGD 13.80 needs review.",
    });
    expect(read({ isPurchaseReceipt: false, concerns: ["A price list"] }).explanation).toBe(
      "The receipt reader says this image is not a purchase receipt (A price list), so the entered SGD 13.80 needs review.",
    );
  });

  it("ignores blank concerns rather than inventing a dispute", () => {
    expect(read({ concerns: ["  "] }).status).toBe("CONFIRMED");
  });

  it("disputes a total that differs by a single cent and names both amounts", () => {
    expect(read({ total: "13.81" })).toEqual({
      status: "DISPUTED",
      explanation:
        "The amount read from the receipt from Print Hub is SGD 13.81, but SGD 13.80 was entered, so it needs review.",
    });
  });

  it("disputes a receipt in another currency", () => {
    expect(read({ currency: "myr" })).toMatchObject({
      status: "DISPUTED",
      explanation:
        "The amount read from the receipt from Print Hub is MYR 13.80, but SGD 13.80 was entered, so it needs review.",
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

  it("leaves the amount SUBMITTED when no reader is set up", () => {
    expect(decideExpense(entered, { kind: "NO_READER" })).toEqual({
      status: "SUBMITTED",
      explanation: "No receipt reader is set up, so the entered SGD 13.80 waits for review.",
    });
  });

  it("disputes the amount when the reader failed, so a person can decide", () => {
    expect(decideExpense(entered, { kind: "READER_FAILED", reason: "timeout" })).toEqual({
      status: "DISPUTED",
      explanation:
        "The receipt reader could not check this receipt (timeout), so the entered SGD 13.80 needs review.",
    });
  });

  it("never confirms an amount the runner did not enter", () => {
    const confirmed = read({ total: "99.00" });
    expect(confirmed.status).not.toBe("CONFIRMED");
  });
});
