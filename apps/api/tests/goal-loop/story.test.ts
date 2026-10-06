import { auditEventTypes, type TimelineEventView } from "@datum/core";
import { describe, expect, it } from "vitest";
import { timelineDescribers } from "../../src/views/timeline";
import { fixturePlanner } from "../planner/fixture-model";
import { call, resetDatabaseBetweenTests } from "../support";
import { fieldCampaign, markDoneWithoutValidPhoto, placeAndProve, refreshed } from "./field";
import { loopDeps, runPass } from "./loop";

resetDatabaseBetweenTests();

const loopTypes = new Set([
  "STATUS_CHANGED",
  "GOAL_EVALUATED",
  "GAP_DETECTED",
  "REMEDIATION_PROPOSED",
  "REMEDIATION_FALLBACK",
  "RECOVERY_CREATED",
  "RECEIPT_PUBLISHED",
]);

describe("the timeline tells the Goal Loop story in plain words (Gate 6)", () => {
  it("can describe every audit event type", () => {
    expect(auditEventTypes.filter((type) => timelineDescribers[type] === undefined)).toEqual([]);
  });

  it("reads first pass, miss, remediation, completion", async () => {
    const field = await fieldCampaign(["A", "B", "C", "D"], "60.00");
    await placeAndProve(field, "A");
    await placeAndProve(field, "B");
    await markDoneWithoutValidPhoto(field, "C");
    await placeAndProve(field, "D");
    const planner = fixturePlanner({
      actions: [{ spotCodes: ["C"], dueInMinutes: 40, runnerNote: "Keep the code in frame." }],
      rationale: "Only Spot C is missing, so one short trip covers it.",
    });
    await runPass(loopDeps({ planner }));
    await placeAndProve(await refreshed(field), "C", 5);
    await runPass();
    const id = field.campaign.id;
    const timeline = (await call<TimelineEventView[]>("GET", `/campaigns/${id}/timeline`)).body;
    const story = timeline
      .filter((event) => loopTypes.has(event.type))
      .slice(
        timeline
          .filter((event) => loopTypes.has(event.type))
          .findIndex((event) => event.summary.startsWith("Status moved from EXECUTING")),
      )
      .map(({ actor, summary }) => [actor, summary.replace(/\d+ minutes to/, "N minutes to")]);
    const receipt = timeline.at(-1)?.summary ?? "";
    expect(story).toEqual([
      [
        "DATUM_RULES",
        "Status moved from EXECUTING to VERIFYING: Datum is checking the evidence against the goal",
      ],
      ["DATUM_RULES", "3 of 4 spots verified"],
      ["DATUM_RULES", "Spot C unresolved: no valid evidence before the task closed"],
      [
        "DATUM_RULES",
        "Status moved from VERIFYING to REMEDIATING: Datum is planning how to recover the unresolved spots",
      ],
      [
        "DATUM_AI",
        "claude-sonnet-5-5 proposed 1 recovery trip: Spot C within 40 minutes. Only Spot C is missing, so one short trip covers it.",
      ],
      [
        "DATUM_RULES",
        "Recovery task for Spot C dispatched within SGD 14.00 remaining and N minutes to the deadline",
      ],
      ["DATUM_RULES", "Status moved from REMEDIATING to EXECUTING: the physical work is under way"],
      [
        "DATUM_RULES",
        "Status moved from EXECUTING to VERIFYING: Datum is checking the evidence against the goal",
      ],
      ["DATUM_RULES", "4 of 4 spots verified"],
      ["DATUM_RULES", "Status moved from VERIFYING to COMPLETED: every approved spot is live"],
      ["DATUM_RULES", receipt],
    ]);
    expect(receipt).toMatch(
      /^Published the Campaign Receipt: 4 of 4 spots live, 3 on the first pass, 1 recovery, 0 post-approval interventions, SGD 56\.00 spent \(sha256 [0-9a-f]{12}\)$/,
    );
  });
});
