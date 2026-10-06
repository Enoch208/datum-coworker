import type { ApiError, CampaignView, TimelineEventView } from "@datum/core";
import { brands, campaigns } from "@datum/db";
import { describe, expect, it } from "vitest";
import { createCampaign as createCampaignDirectly } from "../src/services/campaigns";
import {
  app,
  appBaseUrl,
  briefBody,
  call,
  createCampaign,
  db,
  resetDatabaseBetweenTests,
} from "./support";

resetDatabaseBetweenTests();

describe("POST /campaigns", () => {
  it("creates a draft campaign with its brand, spots and spot QR targets", async () => {
    const reply = await call<CampaignView>("POST", "/campaigns", briefBody());
    expect(reply.status).toBe(201);
    const campaign = reply.body;
    expect(campaign).toMatchObject({
      status: "DRAFT",
      brand: { name: "Kopi Lab", website: "https://kopilab.example" },
      message: "Show this card for a free oat flat white",
      destinationUrl: "https://kopilab.example/offer",
      budget: { amount: "50.00", currency: "SGD" },
      approvedAt: null,
      completedAt: null,
      playbook: null,
      proposal: null,
      approval: null,
    });
    expect(campaign.id).toMatch(/^cmp_[0-9a-z]{16}$/);
    expect(campaign.spots.map((spot) => [spot.code, spot.qrTargetUrl])).toEqual([
      ["A", `${appBaseUrl}/c/${campaign.id}/A`],
      ["B", `${appBaseUrl}/c/${campaign.id}/B`],
    ]);
    expect(
      campaign.spots.every(
        (spot) => spot.status === "PENDING" && spot.scanCount === 0 && spot.card === null,
      ),
    ).toBe(true);
  });

  it("stores the wire budget as exact integer cents", async () => {
    const campaign = await createCampaign({ budget: { amount: "37.8", currency: "SGD" } });
    expect(campaign.budget).toEqual({ amount: "37.80", currency: "SGD" });
    const [row] = await db.select().from(campaigns);
    expect(row?.budgetMinor).toBe(3_780);
  });

  it("reuses an existing brand whatever the casing of its name", async () => {
    const first = await createCampaign();
    const second = await createCampaign({ brandName: "KOPI LAB", brandUrl: null });
    expect(second.brand.id).toBe(first.brand.id);
    expect(await db.select().from(brands)).toHaveLength(1);
  });

  it.each([
    [
      "duplicate spot codes",
      {
        spots: [
          { code: "A", name: "Window", instructions: "Tape inside" },
          { code: "A", name: "Board", instructions: "Pin it" },
        ],
      },
    ],
    ["a past deadline", { deadline: new Date(Date.now() - 60_000).toISOString() }],
    ["a zero budget", { budget: { amount: "0.00", currency: "SGD" } }],
    ["a negative budget", { budget: { amount: "-1.00", currency: "SGD" } }],
    ["a sub-cent budget", { budget: { amount: "12.505", currency: "SGD" } }],
    ["a numeric budget", { budget: { amount: 50, currency: "SGD" } }],
    ["a minor-unit budget", { budget: { amountMinor: 5_000, currency: "SGD" } }],
    ["an unsupported currency", { budget: { amount: "50.00", currency: "USD" } }],
    ["a lowercase spot code", { spots: [{ code: "a", name: "Window", instructions: "Tape" }] }],
    ["a five-character spot code", { spots: [{ code: "ABCDE", name: "W", instructions: "T" }] }],
    ["no spots", { spots: [] }],
    ["a non-web destination", { destinationUrl: "javascript:alert(1)" }],
    ["a deadline without an offset", { deadline: "2099-01-01T10:00:00" }],
    ["an unknown field", { approvedBy: "someone" }],
    ["a brand name the card cannot print", { brandName: "咖啡 Lab" }],
  ])("rejects %s with 400 and stores nothing", async (_label, overrides) => {
    const reply = await call<ApiError>("POST", "/campaigns", { ...briefBody(), ...overrides });
    expect(reply.status).toBe(400);
    expect(reply.body.error).toBe("VALIDATION_FAILED");
    expect(await db.select().from(campaigns)).toEqual([]);
  });

  it("refuses a budget above SGD 100000.00 and says what the limit is", async () => {
    for (const amount of ["99999999999.00", "100000.01"]) {
      const reply = await call<ApiError>(
        "POST",
        "/campaigns",
        briefBody({ budget: { amount, currency: "SGD" } }),
      );
      expect(reply.status).toBe(400);
      expect(reply.body).toMatchObject({ error: "VALIDATION_FAILED" });
      expect(reply.body.message).toContain("The budget can be at most SGD 100000.00");
    }
    const atLimit = await createCampaign({ budget: { amount: "100000.00", currency: "SGD" } });
    expect(atLimit.budget).toEqual({ amount: "100000.00", currency: "SGD" });
  });

  it("names the duplicated spot code in the validation message", async () => {
    const spot = { code: "C", name: "Board", instructions: "Pin it" };
    const reply = await call<ApiError>("POST", "/campaigns", briefBody({ spots: [spot, spot] }));
    expect(reply.body.message).toContain("Spot code C is used more than once");
  });

  it("rejects malformed JSON with 400", async () => {
    const response = await app.request("/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(response.status).toBe(400);
  });

  it("writes the campaign, spots and audit event in one transaction", async () => {
    const spot = { code: "A", name: "Window", instructions: "Tape inside" };
    const input = {
      ...briefBody(),
      spots: [spot, spot],
      deadline: new Date(Date.now() + 3_600_000),
      budget: { amountMinor: 5_000, currency: "SGD" as const },
    };
    await expect(createCampaignDirectly(db, appBaseUrl, input)).rejects.toMatchObject({
      cause: { code: "23505", constraint_name: "spots_campaign_code_unique" },
    });
    expect(await db.select().from(campaigns)).toEqual([]);
    expect(await db.select().from(brands)).toEqual([]);
  });
});

describe("GET /campaigns/:id", () => {
  it("returns the campaign with its spots in code order", async () => {
    const created = await createCampaign({
      spots: [
        { code: "C", name: "Library board", instructions: "Pin it" },
        { code: "A", name: "Cafe window", instructions: "Tape inside" },
        { code: "B", name: "Gym counter", instructions: "Leave a stack" },
      ],
    });
    const reply = await call<CampaignView>("GET", `/campaigns/${created.id}`);
    expect(reply.status).toBe(200);
    expect(reply.body).toEqual(created);
    expect(reply.body.spots.map((spot) => spot.code)).toEqual(["A", "B", "C"]);
  });

  it("returns 404 for unknown and malformed campaign ids", async () => {
    for (const path of [
      "/campaigns/cmp_0000000000000000",
      "/campaigns/not-an-id",
      "/campaigns/cmp_0000000000000000/timeline",
    ]) {
      const reply = await call<ApiError>("GET", path);
      expect(reply.status).toBe(404);
      expect(reply.body.error).toBe("NOT_FOUND");
    }
  });
});

describe("GET /campaigns/:id/timeline", () => {
  it("starts with the customer creating the campaign", async () => {
    const created = await createCampaign();
    const reply = await call<TimelineEventView[]>("GET", `/campaigns/${created.id}/timeline`);
    expect(reply.status).toBe(200);
    expect(reply.body).toEqual([
      {
        id: expect.stringMatching(/^evt_/) as unknown,
        type: "CAMPAIGN_CREATED",
        actor: "CUSTOMER",
        summary: `Campaign created for 2 spots (B, A) with a SGD 50.00 budget, due ${created.deadline}`,
        at: expect.any(String) as unknown,
      },
    ]);
  });
});
