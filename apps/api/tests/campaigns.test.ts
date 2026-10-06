import { brands, campaigns } from "@datum/db";
import { describe, expect, it } from "vitest";
import type { errorBody } from "../src/http/errors";
import { createCampaign as createCampaignDirectly } from "../src/services/campaigns";
import {
  app,
  appBaseUrl,
  briefBody,
  call,
  createCampaign,
  db,
  resetDatabaseBetweenTests,
  type CampaignDetail,
} from "./support";

resetDatabaseBetweenTests();

type ErrorBody = ReturnType<typeof errorBody>;

describe("POST /campaigns", () => {
  it("creates a draft campaign with its brand, spots and spot QR targets", async () => {
    const reply = await call<CampaignDetail>("POST", "/campaigns", briefBody());
    expect(reply.status).toBe(201);
    const { campaign, spots, approval } = reply.body;
    expect(campaign).toMatchObject({
      status: "DRAFT",
      brand: { name: "Kopi Lab", website: "https://kopilab.example" },
      brandPlaybookVersion: null,
      message: "Show this card for a free oat flat white",
      destinationUrl: "https://kopilab.example/offer",
      budget: { amountMinor: 5_000, currency: "SGD" },
      approvedAt: null,
      completedAt: null,
    });
    expect(campaign.id).toMatch(/^cmp_[0-9a-z]{16}$/);
    expect(spots.map((spot) => [spot.code, spot.qrTargetUrl])).toEqual([
      ["A", `${appBaseUrl}/c/${campaign.id}/A`],
      ["B", `${appBaseUrl}/c/${campaign.id}/B`],
    ]);
    expect(spots.every((spot) => spot.status === "PENDING" && spot.scanCount === 0)).toBe(true);
    expect(approval).toBeNull();
  });

  it("reuses an existing brand whatever the casing of its name", async () => {
    const first = await createCampaign();
    const second = await createCampaign({ brandName: "KOPI LAB", brandUrl: null });
    expect(second.campaign.brand.id).toBe(first.campaign.brand.id);
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
    ["a zero budget", { budget: { amountMinor: 0, currency: "SGD" } }],
    ["a negative budget", { budget: { amountMinor: -100, currency: "SGD" } }],
    ["a fractional minor amount", { budget: { amountMinor: 12.5, currency: "SGD" } }],
    ["an unsupported currency", { budget: { amountMinor: 5_000, currency: "USD" } }],
    ["a lowercase spot code", { spots: [{ code: "a", name: "Window", instructions: "Tape" }] }],
    ["no spots", { spots: [] }],
    ["a non-web destination", { destinationUrl: "javascript:alert(1)" }],
    ["a deadline without an offset", { deadline: "2099-01-01T10:00:00" }],
    ["an unknown field", { approvedBy: "someone" }],
  ])("rejects %s with 400 and stores nothing", async (_label, overrides) => {
    const reply = await call<ErrorBody>("POST", "/campaigns", { ...briefBody(), ...overrides });
    expect(reply.status).toBe(400);
    expect(reply.body.error).toBe("VALIDATION_FAILED");
    expect(await db.select().from(campaigns)).toEqual([]);
  });

  it("names the duplicated spot code in the validation message", async () => {
    const spot = { code: "C", name: "Board", instructions: "Pin it" };
    const reply = await call<ErrorBody>("POST", "/campaigns", briefBody({ spots: [spot, spot] }));
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
    const reply = await call<CampaignDetail>("GET", `/campaigns/${created.campaign.id}`);
    expect(reply.status).toBe(200);
    expect(reply.body.campaign).toEqual(created.campaign);
    expect(reply.body.spots.map((spot) => spot.code)).toEqual(["A", "B", "C"]);
  });

  it("returns 404 for unknown and malformed campaign ids", async () => {
    for (const path of [
      "/campaigns/cmp_0000000000000000",
      "/campaigns/not-an-id",
      "/campaigns/cmp_0000000000000000/timeline",
    ]) {
      const reply = await call<ErrorBody>("GET", path);
      expect(reply.status).toBe(404);
      expect(reply.body.error).toBe("NOT_FOUND");
    }
  });
});

describe("GET /campaigns/:id/timeline", () => {
  it("starts with CAMPAIGN_CREATED", async () => {
    const created = await createCampaign();
    const reply = await call<{ type: string; payload: unknown; createdAt: string }[]>(
      "GET",
      `/campaigns/${created.campaign.id}/timeline`,
    );
    expect(reply.status).toBe(200);
    expect(reply.body).toHaveLength(1);
    expect(reply.body[0]).toMatchObject({
      type: "CAMPAIGN_CREATED",
      payload: {
        brandId: created.campaign.brand.id,
        spotCodes: ["B", "A"],
        budget: { amountMinor: 5_000, currency: "SGD" },
        deadline: created.campaign.deadline,
      },
    });
  });
});
