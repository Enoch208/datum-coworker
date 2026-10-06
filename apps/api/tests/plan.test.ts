import type { ApiError, CampaignView } from "@datum/core";
import { eq } from "drizzle-orm";
import { auditEvents, brandPlaybooks, campaignAssets, campaigns, physicalTasks } from "@datum/db";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { decodeQr } from "./cards/decode";
import { assetBytes, plannedCampaign } from "./flows";
import { fixturePlanner, plannerFixture } from "./planner/fixture-model";
import {
  app,
  call,
  callApp,
  createCampaign,
  db,
  readKopiLabPage,
  resetDatabaseBetweenTests,
  testDeps,
} from "./support";

resetDatabaseBetweenTests();

const plan = (campaignId: string, target = app) =>
  callApp<CampaignView & ApiError>(target, "POST", `/campaigns/${campaignId}/plan`);

const auditTypes = async (campaignId: string) =>
  (await db.select().from(auditEvents).where(eq(auditEvents.campaignId, campaignId))).map(
    (event) => event.type,
  );

describe("POST /campaigns/:id/plan (Gate 1)", () => {
  it("drafts the playbook, an AI proposal priced by the rules and a card per spot", async () => {
    const campaign = await plannedCampaign();
    expect(campaign.status).toBe("AWAITING_APPROVAL");
    expect(campaign.playbook).toMatchObject({
      version: 1,
      website: "https://kopilab.example",
      defaultPrintFormat: "A5",
      maxAutonomousPhysicalSpend: { amount: "50.00", currency: "SGD" },
      notes: expect.arrayContaining(['Brand page title: "Kopi Lab | Specialty coffee"']) as unknown,
    });
    expect(campaign.playbook?.forbiddenClaims).toContain("guaranteed");
    expect(campaign.proposal).toMatchObject({
      assetVersion: 1,
      copy: { headline: "Your oat flat white is on us" },
      printFormat: "A6",
      steps: [
        { type: "PRINT_AND_COLLECT", quantity: 4, estimatedCost: { amount: "6.00" } },
        { type: "PLACE_SPOT", spotCode: "A", estimatedCost: { amount: "10.00" } },
        { type: "PLACE_SPOT", spotCode: "B", estimatedCost: { amount: "10.00" } },
      ],
      estimatedSpend: { amount: "26.00", currency: "SGD" },
      evidencePolicy: "photo_with_decodable_spot_qr",
      plannedBy: { model: "claude-sonnet-5-5" },
    });
    expect(campaign.proposal?.assetHash).toMatch(/^[0-9a-f]{64}$/);
    expect(campaign.approval).toBeNull();
  });

  it("gives each spot a unique QR whose printed card scans to it and redirects", async () => {
    const campaign = await plannedCampaign();
    const urls = campaign.spots.map((spot) => spot.qrTargetUrl);
    expect(new Set(urls).size).toBe(campaign.spots.length);
    for (const spot of campaign.spots) {
      expect(spot.card).not.toBeNull();
      const png = await assetBytes(spot.card?.pngUrl ?? "");
      expect(await decodeQr(png)).toBe(spot.qrTargetUrl);
      const scan = await app.request(new URL(spot.qrTargetUrl).pathname);
      expect(scan.status).toBe(302);
      expect(scan.headers.get("location")).toBe("https://kopilab.example/offer");
    }
  });

  it("starts no action and records no approval before or after planning", async () => {
    const draft = await createCampaign();
    expect(draft).toMatchObject({
      status: "DRAFT",
      proposal: null,
      approval: null,
      playbook: null,
    });
    expect(draft.spots.every((spot) => spot.card === null)).toBe(true);
    await plan(draft.id);
    expect(await db.select().from(physicalTasks)).toEqual([]);
    const types = await auditTypes(draft.id);
    expect(types).not.toContain("CAMPAIGN_APPROVED");
    expect(types).toEqual([
      "CAMPAIGN_CREATED",
      "STATUS_CHANGED",
      "PLAYBOOK_DRAFTED",
      "PLAN_GENERATED",
      "PLAN_VALIDATED",
      "STATUS_CHANGED",
      "CARDS_RENDERED",
    ]);
  });

  it("returns the existing proposal instead of planning twice", async () => {
    const planner = fixturePlanner(plannerFixture("plan-accepted"));
    const target = createApp(testDeps({ planner }));
    const campaign = await createCampaign();
    const first = await plan(campaign.id, target);
    const second = await plan(campaign.id, target);
    expect(second.body).toEqual(first.body);
    expect(planner.prompts).toHaveLength(1);
    expect(await db.select().from(campaignAssets)).toHaveLength(1);
  });

  it("answers a typed 503 without an AI planner and leaves the campaign a draft", async () => {
    const campaign = await createCampaign();
    const reply = await plan(campaign.id, createApp(testDeps({ planner: null })));
    expect(reply).toMatchObject({ status: 503, body: { error: "PLANNER_UNAVAILABLE" } });
    const [row] = await db.select().from(campaigns);
    expect(row?.status).toBe("DRAFT");
  });

  it("answers a typed 503 naming the missing cost rates", async () => {
    const campaign = await createCampaign();
    const rates = {
      configured: false,
      missing: ["DATUM_PRINT_COST_PER_COPY", "DATUM_PLACEMENT_COST_PER_SPOT"],
    } as const;
    const reply = await plan(campaign.id, createApp(testDeps({ rates })));
    expect(reply).toMatchObject({ status: 503, body: { error: "COST_RATES_MISSING" } });
    expect(reply.body.message).toContain(
      "DATUM_PRINT_COST_PER_COPY and DATUM_PLACEMENT_COST_PER_SPOT",
    );
    expect(await db.select().from(campaignAssets)).toEqual([]);
  });

  it("records a rejected AI plan, keeps planning open and accepts a retry", async () => {
    const campaign = await createCampaign();
    const rejecting = createApp(
      testDeps({ planner: fixturePlanner(plannerFixture("plan-unknown-spot")) }),
    );
    const rejected = await plan(campaign.id, rejecting);
    expect(rejected).toMatchObject({ status: 502, body: { error: "PLAN_REJECTED" } });
    expect(rejected.body.message).toContain("UNKNOWN_SPOT");
    expect((await db.select().from(campaigns))[0]?.status).toBe("PLANNING");
    expect(await auditTypes(campaign.id)).toContain("PLAN_REJECTED");
    expect(await db.select().from(campaignAssets)).toEqual([]);
    const retried = await plan(campaign.id);
    expect(retried.body.status).toBe("AWAITING_APPROVAL");
  });

  it("warns the customer when the brand page could not be read", async () => {
    const target = createApp(
      testDeps({
        readBrandPage: (url) =>
          Promise.resolve({ outcome: "FAILED", url: url ?? "", reason: "it is not an HTML page" }),
      }),
    );
    const campaign = await createCampaign();
    const reply = await plan(campaign.id, target);
    expect(reply.body.proposal?.customerWarnings[0]).toBe(
      "Datum could not read https://kopilab.example (it is not an HTML page), so the Brand Playbook was drafted from the brand name and message only.",
    );
  });

  it("warns instead of trimming when the estimate is above the budget", async () => {
    const campaign = await plannedCampaign({ budget: { amount: "20.00", currency: "SGD" } });
    expect(campaign.proposal?.estimatedSpend.amount).toBe("26.00");
    expect(campaign.proposal?.steps).toHaveLength(3);
    expect(campaign.proposal?.customerWarnings).toContain(
      "The estimated physical spend of SGD 26.00 is above the SGD 20.00 budget. Approving does not raise the budget: Datum stops and asks before spending past it.",
    );
  });

  it("reuses a returning brand's playbook without reading its page again", async () => {
    await plannedCampaign();
    const urls: (string | null)[] = [];
    const target = createApp(
      testDeps({
        readBrandPage: (url) => {
          urls.push(url);
          return readKopiLabPage(url);
        },
      }),
    );
    const second = await createCampaign({ message: "Bring a friend, both coffees half price" });
    const reply = await plan(second.id, target);
    expect(reply.body.playbook?.version).toBe(1);
    expect(urls).toEqual([]);
    expect(await db.select().from(brandPlaybooks)).toHaveLength(1);
  });

  it("refuses to plan a cancelled campaign or one past its deadline", async () => {
    const cancelled = await createCampaign();
    await db.update(campaigns).set({ status: "CANCELLED" }).where(eq(campaigns.id, cancelled.id));
    expect(await plan(cancelled.id)).toMatchObject({
      status: 409,
      body: { error: "INVALID_STATE" },
    });
    const late = await createCampaign();
    await db
      .update(campaigns)
      .set({ deadline: new Date(Date.now() - 1_000) })
      .where(eq(campaigns.id, late.id));
    expect(await plan(late.id)).toMatchObject({ status: 409, body: { error: "DEADLINE_PASSED" } });
  });

  it("answers 404 for an unknown campaign", async () => {
    expect(await call("POST", "/campaigns/cmp_0000000000000000/plan")).toMatchObject({
      status: 404,
    });
  });
});
