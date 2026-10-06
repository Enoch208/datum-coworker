import { isMoneyText, parseMoney, type Currency, type Money } from "@datum/core";
import { conflict, invalidRequest } from "../http/errors";
import type { RunnerTask } from "../runners/tasks";

export interface ExpenseInput {
  readonly receipt: Uint8Array;
  readonly amountText: string | null;
  readonly merchantText: string | null;
}

export function enteredAmount(text: string | null, currency: Currency): Money {
  const trimmed = text?.trim() ?? "";
  if (!isMoneyText(trimmed)) {
    throw invalidRequest('Send the amount paid as a decimal such as "13.80" in the field "amount"');
  }
  const amount = parseMoney(trimmed, currency);
  if (amount.amountMinor <= 0) throw invalidRequest("The amount paid must be more than zero");
  return amount;
}

export function enteredMerchant(text: string | null): string | null {
  const trimmed = text?.trim() ?? "";
  if (trimmed.length > 120) throw invalidRequest("The merchant name is longer than 120 characters");
  return trimmed.length === 0 ? null : trimmed;
}

export function assertTakesReceipts({ task }: RunnerTask): void {
  if (task.type !== "PRINT_AND_COLLECT") {
    throw conflict("NOT_A_PRINT_RUN", "Only a print run takes a receipt");
  }
  if (task.status === "DISPATCHED") {
    throw conflict("TASK_NOT_ACCEPTED", "Accept this task before uploading its receipt");
  }
  if (task.status === "CANCELLED" || task.status === "EXPIRED") {
    throw conflict("TASK_CLOSED", `This task is ${task.status} and can no longer change`);
  }
}
