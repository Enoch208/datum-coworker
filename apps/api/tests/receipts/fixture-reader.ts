import { readFileSync } from "node:fs";
import {
  receiptModelId,
  ReceiptReaderError,
  type ReceiptReader,
  type ReceiptReaderFailure,
} from "../../src/receipts/reader";
import { receiptReadingSchema } from "../../src/receipts/schema";

export interface FixtureReceiptReader extends ReceiptReader {
  readonly calls: Buffer[];
}

export function receiptFixture(name: string): unknown {
  const parsed: unknown = JSON.parse(
    readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"),
  );
  return parsed;
}

export function fixtureReceiptReader(output: unknown): FixtureReceiptReader {
  const calls: Buffer[] = [];
  return {
    calls,
    read(jpeg) {
      calls.push(jpeg);
      return Promise.resolve({
        model: receiptModelId,
        reading: receiptReadingSchema.parse(output),
      });
    },
  };
}

export function failingReceiptReader(code: ReceiptReaderFailure): FixtureReceiptReader {
  const calls: Buffer[] = [];
  return {
    calls,
    read(jpeg) {
      calls.push(jpeg);
      return Promise.reject(new ReceiptReaderError(code, "The fixture reader failed on purpose"));
    },
  };
}
