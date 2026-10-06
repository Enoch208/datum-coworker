import type { TimelineEventView } from "@datum/core";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { approve, editCopy, plannedCampaign } from "./flows";
import { fixturePlanner, plannerFixture } from "./planner/fixture-model";
import { call, callApp, createCampaign, resetDatabaseBetweenTests, testDeps } from "./support";

resetDatabaseBetweenTests();

const timeline = async (campaignId: string) =>
  (await call<TimelineEventView[]>("GET", `/campaigns/${campaignId}/timeline`)).body;

describe("GET /campaigns/:id/timeline", () => {
  it("says who did what, from brief to approval to re-approval", async () => {
    const campaign = await plannedCampaign();
    await approve(campaign.id, 1);
    await editCopy(campaign.id, { headline: "Oat flat whites on us", subcopy: "Show this card." });
    await approve(campaign.id, 2);
    const events = await timeline(campaign.id);
    const assetHash = campaign.proposal?.assetHash.slice(0, 12) ?? "";
    expect(events.map(({ actor, summary }) => [actor, summary])).toEqual([
      [
        "CUSTOMER",
        `Campaign created for 2 spots (B, A) with a SGD 50.00 budget, due ${campaign.deadline}`,
      ],
      ["DATUM_RULES", "Status moved from DRAFT to PLANNING"],
      [
        "DATUM_RULES",
        "Drafted Brand Playbook v1 from the brand name, the message and the brand page",
      ],
      [
        "DATUM_AI",
        'claude-sonnet-5-5 drafted proposal v1 with 3 steps: "Your oat flat white is on us"',
      ],
      [
        "DATUM_RULES",
        "Rules accepted proposal v1 and estimated SGD 26.00 against the SGD 50.00 budget",
      ],
      ["DATUM_RULES", "Status moved from PLANNING to AWAITING_APPROVAL"],
      [
        "DATUM_RULES",
        `Rendered 2 printable cards for proposal v1, each with its own QR (asset ${assetHash})`,
      ],
      [
        "CUSTOMER",
        `Mei Tan approved proposal v1 with a SGD 50.00 budget, due ${campaign.deadline}`,
      ],
      ["DATUM_RULES", "Status moved from AWAITING_APPROVAL to APPROVED"],
      [
        "CUSTOMER",
        "Customer edited the copy of proposal v1, creating v2; approval v1 no longer applies",
      ],
      ["DATUM_RULES", "Status moved from APPROVED to AWAITING_APPROVAL"],
      [
        "DATUM_RULES",
        expect.stringMatching(/^Rendered 2 printable cards for proposal v2/) as unknown,
      ],
      [
        "CUSTOMER",
        `Mei Tan approved proposal v2 with a SGD 50.00 budget, due ${campaign.deadline}`,
      ],
      ["DATUM_RULES", "Status moved from AWAITING_APPROVAL to APPROVED"],
    ]);
    expect(events.every((event) => !Number.isNaN(Date.parse(event.at)))).toBe(true);
  });

  it("shows a rejected AI plan as the rules' decision", async () => {
    const campaign = await createCampaign();
    const rejecting = createApp(
      testDeps({ planner: fixturePlanner(plannerFixture("plan-forbidden-claim")) }),
    );
    await callApp(rejecting, "POST", `/campaigns/${campaign.id}/plan`);
    const last = (await timeline(campaign.id)).at(-1);
    expect(last).toMatchObject({
      type: "PLAN_REJECTED",
      actor: "DATUM_RULES",
      summary:
        'Rules rejected the plan from claude-sonnet-5-5 (FORBIDDEN_CLAIM): The copy uses the forbidden claim "#1"',
    });
  });

  it("marks an over-budget estimate and a reused playbook", async () => {
    await plannedCampaign();
    const second = await plannedCampaign({ budget: { amount: "20.00", currency: "SGD" } });
    const summaries = (await timeline(second.id)).map((event) => event.summary);
    expect(summaries).toContain("Reused Brand Playbook v1");
    expect(summaries).toContain(
      "Rules accepted proposal v1 and estimated SGD 26.00 against the SGD 20.00 budget, which is over budget",
    );
  });
});
