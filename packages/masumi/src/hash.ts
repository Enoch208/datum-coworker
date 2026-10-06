import { createHash, randomBytes } from "node:crypto";
import { canonicalizeEx } from "json-canonicalize";

export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface TaskInput {
  readonly taskId: string;
  readonly name: string;
  readonly description: string | null;
}

const noncePattern = /^(?:[0-9a-f]{2}){7,13}$/;
const asciiSafePattern = /^[\x20\x21\x23-\x5b\x5d-\x7e]+$/;
export const sha256HexPattern = /^[0-9a-f]{64}$/;

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function newPurchaserNonce(): string {
  return randomBytes(10).toString("hex");
}

export function assertNonce(nonce: string): void {
  if (!noncePattern.test(nonce)) {
    throw new RangeError("identifierFromPurchaser must be 14 to 26 lowercase hex characters");
  }
}

export function canonicalJson(value: JsonValue): string {
  return canonicalizeEx(value, { filterUndefined: true });
}

export function canonicalInputHash(input: JsonValue, nonce: string): string {
  assertNonce(nonce);
  return sha256Hex(`${nonce};${canonicalJson(input)}`);
}

export function taskInputHash(task: TaskInput, nonce: string): string {
  return canonicalInputHash(
    { taskId: task.taskId, name: task.name, description: task.description },
    nonce,
  );
}

export function sokosumiResultHash(result: string, nonce: string): string {
  assertNonce(nonce);
  return sha256Hex(`${nonce};${JSON.stringify(result).slice(1, -1)}`);
}

export function mip004ResultHash(result: string, nonce: string): string {
  assertNonce(nonce);
  return sha256Hex(`${nonce};${result}`);
}

export function isAsciiSafeResult(result: string): boolean {
  return asciiSafePattern.test(result);
}

export function assertAsciiSafeResult(result: string): void {
  if (!isAsciiSafeResult(result)) {
    throw new RangeError(
      "A Gate 0 result must be printable ASCII without quotes, backslashes or control characters",
    );
  }
}
