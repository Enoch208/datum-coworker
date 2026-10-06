import { createHash } from "node:crypto";
import type { ApiError, CampaignReceiptView, GoalStateView } from "@datum/core";
import { describe, expect, it } from "vitest";
import { fixturePlanner } from "../planner/fixture-model";
import { call, resetDatabaseBetweenTests } from "../support";
import {
  fieldCampaign,
  markDoneWithoutValidPhoto,
  placeAndProve,
  refreshed,
  type FieldCampaign,
} from "./field";
import { loopDeps, runPass } from "./loop";

resetDatabaseBetweenTests();

const goalOf = (id: string) => call<GoalStateView>("GET", `/campaigns/${id}/goal`);
const receiptOf = (id: string) =>
  call<CampaignReceiptView & ApiError>("GET", `/campaigns/${id}/receipt`);

async function missedC(): Promise<FieldCampaign> {
  const field = await fieldCampaign(["A", "B", "C", "D"], "60.00");
  await placeAndProve(field, "A");
  await placeAndProve(field, "B");
  await markDoneWithoutValidPhoto(field, "C");
  await placeAndProve(field, "D");
  return field;
}

describe("GET /campaigns/:id/goal", () => {
  it("shows 3 of 4 with Spot C's reason before the loop acts", async () => {
    const field = await missedC();
    const reply = await goalOf(field.campaign.id);
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({
      status: "EXECUTING",
      passed: 3,
      required: 4,
      unresolved: [
        {
          spotCode: "C",
          reasonCode: "CLOSED_WITHOUT_PASS",
          reason:
            "no valid evidence before the task closed: the last photo showed no readable spot code",
        },
      ],
      approvedBudget: { amount: "60.00", currency: "SGD" },
      confirmedSpend: { amount: "16.00", currency: "SGD" },
      committedSpend: { amount: "30.00", currency: "SGD" },
      remainingBudget: { amount: "14.00", currency: "SGD" },
      completedAt: null,
      latestDecision: null,
    });
    expect(
      reply.body.requirements.map((item) => [item.spotCode, item.status, item.attempts]),
    ).toEqual([
      ["A", "PASS", 1],
      ["B", "PASS", 1],
      ["C", "MISS", 1],
      ["D", "PASS", 1],
    ]);
    expect(reply.body.minutesToDeadline).toBeGreaterThan(0);
  });

  it("shows the model's proposal, the rules' verdict and the keys dispatched", async () => {
    const field = await missedC();
    const planner = fixturePlanner({
      actions: [{ spotCodes: ["C", "A"], dueInMinutes: 30, runnerNote: "Go back to C." }],
      rationale: "One trip.",
    });
    await runPass(loopDeps({ planner }));
    const id = field.campaign.id;
    const { body } = await goalOf(id);
    expect(body.requirements.find((item) => item.spotCode === "C")).toMatchObject({
      status: "PENDING",
      attempts: 2,
      openTaskKey: `campaign:${id}:spot:C:attempt:2`,
    });
    expect(body.latestDecision).toMatchObject({
      round: 1,
      gaps: {
        missingSpots: [{ spotCode: "C", reasonCode: "CLOSED_WITHOUT_PASS" }],
        remainingBudget: { amount: "14.00", currency: "SGD" },
      },
      planner: {
        proposal: { actions: [{ spotCodes: ["C", "A"] }], rationale: "One trip." },
        failure: null,
        verdict: { outcome: "REJECTED", reason: "SPOT_NOT_UNRESOLVED", spotCode: "A" },
      },
      fallbackUsed: true,
      verdict: { outcome: "ACCEPTED", planCost: { amount: "10.00", currency: "SGD" } },
      actions: [
        {
          idempotencyKey: `campaign:${id}:spot:C:attempt:2`,
          tasks: [{ spotCode: "C", attempt: 2, idempotencyKey: `campaign:${id}:spot:C:attempt:2` }],
          estimatedCost: { amount: "10.00", currency: "SGD" },
        },
      ],
    });
    expect(body.latestDecision?.appliedAt).not.toBeNull();
  });

  it("answers 404 for an unknown campaign", async () => {
    expect((await call<ApiError>("GET", "/campaigns/cmp_0000000000000000/goal")).status).toBe(404);
  });
});

describe("GET /campaigns/:id/receipt", () => {
  it("is not there until the campaign ends", async () => {
    const field = await missedC();
    expect(await receiptOf(field.campaign.id)).toMatchObject({
      status: 404,
      body: { error: "NO_RECEIPT" },
    });
  });

  it("shows the completed receipt from its stored bytes, with the recovery and zero interventions", async () => {
    const field = await missedC();
    await runPass();
    await placeAndProve(await refreshed(field), "C", 5);
    await runPass();
    const reply = await receiptOf(field.campaign.id);
    expect(reply.status).toBe(200);
    const view = reply.body;
    expect(view).toMatchObject({
      status: "COMPLETED",
      campaignName: "Kopi Lab",
      target: { spots: 4, budget: { amount: "60.00", currency: "SGD" } },
      actual: { spotsPassed: 4, spend: { amount: "56.00", currency: "SGD" } },
      firstPass: { passed: 3, required: 4 },
      recoveryActions: 1,
      postApprovalInterventions: 0,
      interventions: [],
      spend: {
        budget: { amount: "60.00", currency: "SGD" },
        confirmed: { amount: "56.00", currency: "SGD" },
        remaining: { amount: "4.00", currency: "SGD" },
      },
      executors: [{ adapter: "LOCAL_ENROLLED_RUNNER", label: "Local enrolled runner" }],
      masumi: null,
    });
    expect(view.spots.find((spot) => spot.spotCode === "C")).toMatchObject({
      firstPass: "MISS",
      final: "PASS",
      attempts: 2,
      recoveredAfterMiss: true,
    });
    expect(
      view.spots.every((spot) => spot.evidencePhotoUrl?.startsWith("https://datum.test/evidence/")),
    ).toBe(true);
    expect(view.recoveries).toMatchObject([{ source: "FALLBACK", spotCodes: ["C"] }]);
    expect(view.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(view.sha256).not.toBe(createHash("sha256").update("").digest("hex"));
  });
});
