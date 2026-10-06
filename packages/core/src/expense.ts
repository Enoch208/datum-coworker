import type { ExpenseStatus, Money } from "./contract";
import { compareMoney, formatMoney, isMoneyText, parseMoney } from "./money";

export interface ReceiptReading {
  readable: boolean;
  total: string | null;
  currency: string | null;
  merchant: string | null;
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

const receiptFrom = (reading: ReceiptReading): string =>
  reading.merchant === null ? "The receipt" : `The receipt from ${reading.merchant}`;

const comparedTotal = (entered: Money, reading: ReceiptReading, total: string): ExpenseDecision => {
  const shown = parseMoney(total, entered.currency);
  const enteredText = formatMoney(entered);
  if (compareMoney(shown, entered) === 0) {
    return decision(
      "CONFIRMED",
      `${receiptFrom(reading)} shows ${formatMoney(shown)}, matching the entered ${enteredText}.`,
    );
  }
  return decision(
    "DISPUTED",
    `${receiptFrom(reading)} shows ${formatMoney(shown)}, but ${enteredText} was entered, so it needs review.`,
  );
};

const readDecision = (entered: Money, reading: ReceiptReading): ExpenseDecision => {
  const enteredText = formatMoney(entered);
  const total = reading.total;
  if (!reading.readable || total === null || !isMoneyText(total)) {
    return decision(
      "DISPUTED",
      `The receipt total could not be read, so the entered ${enteredText} needs review.`,
    );
  }
  const currency = reading.currency?.toUpperCase() ?? null;
  if (currency === null) {
    return decision(
      "DISPUTED",
      `The receipt does not show its currency, so the entered ${enteredText} needs review.`,
    );
  }
  if (currency !== entered.currency) {
    return decision(
      "DISPUTED",
      `${receiptFrom(reading)} is in ${currency} ${total}, but ${enteredText} was entered, so it needs review.`,
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
