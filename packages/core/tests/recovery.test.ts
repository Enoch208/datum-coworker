import { describe, expect, it } from "vitest";
import { actionKey, nextAttempt, recoveryKey, type TaskCoverage } from "../src/recovery";

const campaignId = "cmp_7k2m9q4w8z1x3c5v";
const key = (spotCode: string, attempt: number) => recoveryKey(campaignId, spotCode, attempt);

describe("recoveryKey", () => {
  it("formats campaign:<id>:spot:<code>:attempt:<n>", () => {
    expect(recoveryKey(campaignId, "C", 2)).toBe(`campaign:${campaignId}:spot:C:attempt:2`);
  });

  it.each([0, -1, 1.5, Number.NaN])("refuses attempt %d", (attempt) => {
    expect(() => recoveryKey(campaignId, "C", attempt)).toThrow(RangeError);
  });

  it.each(["c", "", "ABCDE", "C:1"])("refuses spot code %j", (spotCode) => {
    expect(() => recoveryKey(campaignId, spotCode, 1)).toThrow(RangeError);
  });

  it.each(["", "cmp:1", "cmp+1"])("refuses campaign id %j", (id) => {
    expect(() => recoveryKey(id, "C", 1)).toThrow(RangeError);
  });
});

describe("actionKey", () => {
  it("is exactly the recovery key for a one-spot action", () => {
    expect(actionKey(campaignId, [{ spotCode: "C", attempt: 2 }])).toBe(key("C", 2));
  });

  it("joins the spot attempts of a batched trip in spot order", () => {
    const expected = `campaign:${campaignId}:spot:B:attempt:2+spot:C:attempt:3`;
    expect(
      actionKey(campaignId, [
        { spotCode: "C", attempt: 3 },
        { spotCode: "B", attempt: 2 },
      ]),
    ).toBe(expected);
    expect(
      actionKey(campaignId, [
        { spotCode: "B", attempt: 2 },
        { spotCode: "C", attempt: 3 },
      ]),
    ).toBe(expected);
  });

  it("refuses an action that covers no spot or the same spot twice", () => {
    expect(() => actionKey(campaignId, [])).toThrow(RangeError);
    expect(() =>
      actionKey(campaignId, [
        { spotCode: "C", attempt: 2 },
        { spotCode: "C", attempt: 2 },
      ]),
    ).toThrow(RangeError);
  });
});

describe("nextAttempt", () => {
  const tasks: TaskCoverage[] = [
    { idempotencyKey: "campaign:cmp:print:attempt:1", spotCodes: [], open: false },
    { idempotencyKey: key("A", 1), spotCodes: ["A"], open: false },
    { idempotencyKey: key("C", 1), spotCodes: ["C"], open: false },
    { idempotencyKey: `${key("B", 2)}+spot:C:attempt:2`, spotCodes: ["B", "C"], open: false },
    { idempotencyKey: key("D", 1), spotCodes: ["D"], open: true },
  ];

  it("is one for a spot no task has covered", () => {
    expect(nextAttempt(tasks, "E")).toBe(1);
  });

  it("counts every closed task that covered the spot, batched trips included", () => {
    expect(nextAttempt(tasks, "A")).toBe(2);
    expect(nextAttempt(tasks, "B")).toBe(2);
    expect(nextAttempt(tasks, "C")).toBe(3);
  });

  it("does not count an open task, so re-proposing it yields the same key", () => {
    expect(nextAttempt(tasks, "D")).toBe(1);
  });
});
