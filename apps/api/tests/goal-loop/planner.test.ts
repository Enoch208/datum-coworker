import { eq } from "drizzle-orm";
import type { TimelineEventView } from "@datum/core";
import { physicalTasks, remediationDecisions } from "@datum/db";
import { describe, expect, it } from "vitest";
import { PlannerModelError, plannerModelId, type PlannerModel } from "../../src/planner/model";
import { fixturePlanner, type FixturePlanner } from "../planner/fixture-model";
import { call, db, resetDatabaseBetweenTests } from "../support";
import {
  fieldCampaign,
  markDoneWithoutValidPhoto,
  placeAndProve,
  type FieldCampaign,
} from "./field";
import { loopDeps, runPass } from "./loop";

resetDatabaseBetweenTests();

async function firstPass(budget: string, missed: readonly string[]): Promise<FieldCampaign> {
  const field = await fieldCampaign(["A", "B", "C", "D"], budget);
  for (const code of field.codes) {
    if (missed.includes(code)) await markDoneWithoutValidPhoto(field, code);
    else await placeAndProve(field, code);
  }
  return field;
}

const recoveryTasks = async (campaignId: string) =>
  (await db.select().from(physicalTasks).where(eq(physicalTasks.campaignId, campaignId)))
    .filter((task) => task.attempt > 1)
    .sort((left, right) => left.idempotencyKey.localeCompare(right.idempotencyKey));

const decisions = () => db.select().from(remediationDecisions);

const timeline = async (campaignId: string) =>
  (await call<TimelineEventView[]>("GET", `/campaigns/${campaignId}/timeline`)).body;

const trip = (spotCodes: string[], dueInMinutes = 30, runnerNote = "Check the board first.") => ({
  spotCodes,
  dueInMinutes,
  runnerNote,
});

const proposing = (
  actions: unknown[],
  rationale = "Both boards are a short walk apart.",
): FixturePlanner => fixturePlanner({ actions, rationale });

const failing: PlannerModel = {
  propose: () => Promise.reject(new PlannerModelError("API_ERROR", "The planner API failed: 529")),
};

describe("the recovery planner inside the Goal Loop (Gate 6)", () => {
  it("dispatches the model's validated plan with its runner note and due time", async () => {
    const field = await firstPass("60.00", ["C"]);
    const planner = proposing([
      trip(["C"], 30, "The first photo had no readable code; keep the whole card in frame."),
    ]);
    const now = new Date();
    expect((await runPass(loopDeps({ planner, now: () => now }))).failed).toEqual([]);
    const [task] = await recoveryTasks(field.campaign.id);
    expect(task).toMatchObject({
      idempotencyKey: `campaign:${field.campaign.id}:spot:C:attempt:2`,
      status: "DISPATCHED",
      estimatedCostMinor: 1_000,
      dueBy: new Date(now.getTime() + 30 * 60_000),
    });
    expect(task?.instructions).toMatch(
      /upload it\. This time: The first photo had no readable code; keep the whole card in frame\.$/,
    );
    const [decision] = await decisions();
    expect(decision).toMatchObject({
      round: 1,
      plannerModel: plannerModelId,
      fallbackUsed: false,
      proposalVerdict: { outcome: "ACCEPTED" },
      verdict: { outcome: "ACCEPTED", planCost: { amountMinor: 1_000, currency: "SGD" } },
    });
    const [prompt] = planner.prompts;
    const request: unknown = JSON.parse(prompt?.user.split("\n\n")[1] ?? "null");
    expect(request).toMatchObject({
      remainingBudget: "SGD 14.00",
      missingSpots: [
        {
          code: "C",
          name: "Far East Square community board",
          whyUnresolved:
            "no valid evidence before the task closed: the last photo showed no readable spot code",
        },
      ],
      openTasks: ["A", "B", "D"].map(
        (code) => `campaign:${field.campaign.id}:spot:${code}:attempt:1`,
      ),
    });
    expect(prompt?.user).not.toMatch(/induced|demo/i);
    expect(prompt?.system).toMatch(/never repeat them; say only what changes/);
    const story = (await timeline(field.campaign.id)).filter((event) =>
      ["REMEDIATION_PROPOSED", "RECOVERY_CREATED"].includes(event.type),
    );
    expect(story.map(({ type, actor }) => [type, actor])).toEqual([
      ["REMEDIATION_PROPOSED", "DATUM_AI"],
      ["RECOVERY_CREATED", "DATUM_RULES"],
    ]);
    expect(story[1]?.summary).toMatch(
      /^Recovery task for Spot C dispatched within SGD 14\.00 remaining and \d+ minutes to the deadline$/,
    );
  });

  it("replans two misses once, as one trip covering both, the same path as one miss", async () => {
    const field = await firstPass("70.00", ["B", "C"]);
    const planner = proposing([trip(["C", "B"])]);
    expect((await runPass(loopDeps({ planner }))).failed).toEqual([]);
    const id = field.campaign.id;
    expect((await recoveryTasks(id)).map((task) => task.idempotencyKey)).toEqual([
      `campaign:${id}:spot:B:attempt:2`,
      `campaign:${id}:spot:C:attempt:2`,
    ]);
    expect(planner.prompts).toHaveLength(1);
    const [decision] = await decisions();
    expect(decision?.actions).toMatchObject([
      {
        idempotencyKey: `campaign:${id}:spot:B:attempt:2+spot:C:attempt:2`,
        spotCodes: ["C", "B"],
        estimatedCost: { amountMinor: 2_000, currency: "SGD" },
      },
    ]);
    const created = (await timeline(id)).filter((event) => event.type === "RECOVERY_CREATED");
    expect(created).toHaveLength(1);
    expect(created[0]?.summary).toMatch(
      /^Recovery trip for Spots C and B dispatched within SGD 24\.00/,
    );
    expect((await timeline(id)).filter((event) => event.type === "GAP_DETECTED")).toHaveLength(2);
  });

  it.each([
    ["leaves a missed spot out", [trip(["C"])], "SPOT_LEFT_UNPLANNED"],
    ["targets a spot that already passed", [trip(["A", "B", "C"])], "SPOT_NOT_UNRESOLVED"],
    [
      "gives the runner more time than the deadline allows",
      [trip(["B", "C"], 100_000)],
      "DUE_AFTER_DEADLINE",
    ],
  ])("falls back on the same tick when the model's plan %s", async (_label, actions, reason) => {
    const field = await firstPass("70.00", ["B", "C"]);
    expect((await runPass(loopDeps({ planner: proposing(actions) }))).failed).toEqual([]);
    const id = field.campaign.id;
    expect((await recoveryTasks(id)).map((task) => task.idempotencyKey)).toEqual([
      `campaign:${id}:spot:B:attempt:2`,
      `campaign:${id}:spot:C:attempt:2`,
    ]);
    const [decision] = await decisions();
    expect(decision).toMatchObject({
      fallbackUsed: true,
      proposalVerdict: { outcome: "REJECTED", reason },
      verdict: { outcome: "ACCEPTED" },
    });
    const fallback = (await timeline(id)).find((event) => event.type === "REMEDIATION_FALLBACK");
    expect(fallback?.actor).toBe("DATUM_RULES");
    expect(fallback?.summary).toMatch(
      new RegExp(
        `^Rules rejected the proposed recovery \\(${reason}.*standard recovery: one placement each for Spots B and C$`,
      ),
    );
  });

  it("falls back on the same tick when the model fails, and never waits on it", async () => {
    const field = await firstPass("60.00", ["C"]);
    expect((await runPass(loopDeps({ planner: failing }))).failed).toEqual([]);
    expect(await recoveryTasks(field.campaign.id)).toHaveLength(1);
    const [decision] = await decisions();
    expect(decision).toMatchObject({
      fallbackUsed: true,
      plannerFailure: { code: "API_ERROR" },
      proposal: null,
    });
    const fallback = (await timeline(field.campaign.id)).find(
      (event) => event.type === "REMEDIATION_FALLBACK",
    );
    expect(fallback?.summary).toBe(
      "The recovery planner did not answer usefully (API_ERROR), so Datum used its standard recovery: one placement each for Spot C",
    );
  });

  it("never lets the model name a price: an output carrying money is malformed", async () => {
    const field = await firstPass("60.00", ["C"]);
    const pricing = proposing([{ ...trip(["C"]), estimatedCost: "0.01" }]);
    expect((await runPass(loopDeps({ planner: pricing }))).failed).toEqual([]);
    const [task] = await recoveryTasks(field.campaign.id);
    expect(task?.estimatedCostMinor).toBe(1_000);
    expect((await decisions())[0]).toMatchObject({
      fallbackUsed: true,
      plannerFailure: { code: "MALFORMED_OUTPUT" },
    });
  });

  it("asks the model once per gap and not again on later passes", async () => {
    const field = await firstPass("60.00", ["C"]);
    const planner = proposing([trip(["C"])]);
    await runPass(loopDeps({ planner }));
    await runPass(loopDeps({ planner }));
    await runPass(loopDeps({ planner }));
    expect(planner.prompts).toHaveLength(1);
    expect(await recoveryTasks(field.campaign.id)).toHaveLength(1);
  });
});
