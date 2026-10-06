import { describe, expect, it } from "vitest";
import { checkBrief } from "../src/brief/check";
import type { BriefOutput } from "../src/brief/schema";
import { completeBrief } from "./support/briefs";

describe("checking a campaign brief read from a Task", () => {
  it("turns a complete brief into the same input POST /campaigns accepts", () => {
    const brief = completeBrief();
    const check = checkBrief(brief);
    if (check.kind !== "COMPLETE") throw new Error(check.missing.join("; "));
    expect(check.input).toMatchObject({
      brandName: "Kopi Lab",
      brandUrl: "https://kopilab.example",
      destinationUrl: "https://kopilab.example/offer",
      budget: { amountMinor: 5_000, currency: "SGD" },
      spots: [
        { code: "A", name: "Amoy Street cafe window", instructions: "Tape inside the glass" },
        { code: "B", name: "Telok Ayer notice board", instructions: "Pin at eye level" },
      ],
    });
    expect(check.input.deadline.toISOString()).toBe(new Date(brief.deadline ?? "").toISOString());
  });

  it("reads a budget written the way people write it", () => {
    const check = checkBrief({ ...completeBrief(), budgetSgd: "S$ 1,200" });
    expect(check).toMatchObject({ kind: "COMPLETE", input: { budget: { amountMinor: 120_000 } } });
  });

  it("lists every missing detail in plain words instead of guessing", () => {
    const brief: BriefOutput = {
      ...completeBrief(),
      destinationUrl: null,
      spots: [],
      deadline: null,
      budgetSgd: " ",
    };
    expect(checkBrief(brief)).toEqual({
      kind: "INCOMPLETE",
      missing: [
        "The web address the QR code should open (a full https:// link)",
        "Where the cards should go: at least one spot, and how to put the card up there",
        "The deadline: the date and time every card must be up",
        "The total budget in SGD, for example SGD 60",
      ],
    });
  });

  it("applies the same rules as POST /campaigns to what was given", () => {
    const brief: BriefOutput = {
      ...completeBrief(),
      brandUrl: "kopilab dot example",
      destinationUrl: "ftp://kopilab.example/offer",
      deadline: "2020-01-01T10:00:00+08:00",
      budgetSgd: "0",
      spots: [{ name: "Amoy Street cafe window", instructions: " " }],
    };
    const check = checkBrief(brief);
    expect(check.kind).toBe("INCOMPLETE");
    expect(check.kind === "INCOMPLETE" ? check.missing : []).toEqual([
      "The brand website must be a full http:// or https:// address",
      "The QR link must be a full http:// or https:// address",
      "Spot A (Amoy Street cafe window) needs one sentence on how to put the card up, at most 1000 characters",
      "The deadline must be in the future",
      "The budget must be more than zero",
    ]);
  });

  it("refuses a deadline without a time zone rather than assuming one", () => {
    const check = checkBrief({ ...completeBrief(), deadline: "2030-01-01T10:00:00" });
    expect(check).toEqual({
      kind: "INCOMPLETE",
      missing: ["The deadline must be a date and time with a time zone"],
    });
  });
});
