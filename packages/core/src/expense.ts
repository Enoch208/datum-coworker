import type { ExpenseStatus, Money } from "./contract";
import { compareMoney, formatMoney, isMoneyText, parseMoney } from "./money";

export interface ReceiptReading {
  readable: boolean;
  isPurchaseReceipt: boolean;
  total: string | null;
  currency: string | null;
  merchant: string | null;
  concerns: string[];
}

export type ReceiptCheck =
  | { kind: "NO_READER" }
  | { kind: "READER_FAILED"; reason: string }
  | { kind: "READ"; reading: ReceiptReading };

export interface ExpenseDecision {
  status: ExpenseStatus;
  explanation: string;
}

const decision = (status: ExpenseStatus, explanation: string): ExpenseDecision => ({
  status,
  explanation,
});

const needsReview = (reason: string, entered: Money): ExpenseDecision =>
  decision("DISPUTED", `${reason}, so the entered ${formatMoney(entered)} needs review.`);

const amountRead = (reading: ReceiptReading): string =>
  reading.merchant === null
    ? "The amount read from the receipt"
    : `The amount read from the receipt from ${reading.merchant}`;

const namedConcerns = (reading: ReceiptReading): string[] =>
  reading.concerns.map((concern) => concern.trim()).filter((concern) => concern.length > 0);

const listed = (concerns: readonly string[]): string =>
  concerns.length === 0 ? "" : ` (${concerns.join("; ")})`;

const doubtDecision = (entered: Money, reading: ReceiptReading): ExpenseDecision | null => {
  const concerns = namedConcerns(reading);
  if (!reading.isPurchaseReceipt) {
    return needsReview(
      `The receipt reader says this image is not a purchase receipt${listed(concerns)}`,
      entered,
    );
  }
  if (concerns.length > 0) {
    return needsReview(`The receipt reader flagged this receipt${listed(concerns)}`, entered);
  }
  return null;
};

const comparedTotal = (entered: Money, reading: ReceiptReading, total: string): ExpenseDecision => {
  const shown = parseMoney(total, entered.currency);
  const enteredText = formatMoney(entered);
  if (compareMoney(shown, entered) === 0) {
    return decision("CONFIRMED", `${amountRead(reading)} matches the entered ${enteredText}.`);
  }
  return decision(
    "DISPUTED",
    `${amountRead(reading)} is ${formatMoney(shown)}, but ${enteredText} was entered, so it needs review.`,
  );
};

const readDecision = (entered: Money, reading: ReceiptReading): ExpenseDecision => {
  const doubt = doubtDecision(entered, reading);
  if (doubt !== null) return doubt;
  const total = reading.total;
  if (!reading.readable || total === null || !isMoneyText(total)) {
    return needsReview("The receipt total could not be read", entered);
  }
  const currency = reading.currency?.toUpperCase() ?? null;
  if (currency === null) {
    return needsReview("The receipt does not show its currency", entered);
  }
  if (currency !== entered.currency) {
    return decision(
      "DISPUTED",
      `${amountRead(reading)} is ${currency} ${total}, but ${formatMoney(entered)} was entered, so it needs review.`,
    );
  }
  return comparedTotal(entered, reading, total);
};

export const decideExpense = (entered: Money, check: ReceiptCheck): ExpenseDecision => {
  const enteredText = formatMoney(entered);
  switch (check.kind) {
    case "NO_READER":
      return decision(
        "SUBMITTED",
        `No receipt reader is set up, so the entered ${enteredText} waits for review.`,
      );
    case "READER_FAILED":
      return decision(
        "SUBMITTED",
        `The receipt reader could not check this receipt (${check.reason}), so the entered ${enteredText} waits for review.`,
      );
    case "READ":
      return readDecision(entered, check.reading);
  }
};
