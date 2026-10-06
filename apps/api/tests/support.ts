import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import type { BrandPageReading, CampaignView, CostRates, CreateCampaignRequest } from "@datum/core";
import {
  approvals,
  auditEvents,
  brandPlaybooks,
  brands,
  campaignAssets,
  campaignReceipts,
  campaigns,
  createDb,
  evidence,
  expenses,
  interventions,
  masumiPaymentEvidence,
  physicalTasks,
  remediationDecisions,
  runners,
  scanEvents,
  spots,
} from "@datum/db";
import { afterAll, beforeEach } from "vitest";
import { createApp } from "../src/app";
import type { BrandPageReader } from "../src/brand-page/reader";
import type { ApiDeps } from "../src/deps";
import type { RateSettings } from "../src/env";
import { fixturePlanner, plannerFixture } from "./planner/fixture-model";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || !databaseUrl.endsWith("/datum_test")) {
  throw new Error("API tests must run against the datum_test database");
}

export const db = createDb(databaseUrl);
export const appBaseUrl = "https://datum.test";
export const operatorKey = "operator-key-for-tests-0123456789abcdef";
export const assetDir = mkdtempSync(join(tmpdir(), "datum-api-assets-"));
export const evidenceDir = mkdtempSync(join(tmpdir(), "datum-api-evidence-"));

export const testCostRates: CostRates = {
  printCostPerCopy: { amountMinor: 150, currency: "SGD" },
  placementCostPerSpot: { amountMinor: 1_000, currency: "SGD" },
};

export const testRates: RateSettings = { configured: true, rates: testCostRates };

export const readKopiLabPage: BrandPageReader = (url) => {
  if (url === null) return Promise.resolve({ outcome: "NOT_GIVEN" });
  const reading: BrandPageReading = {
    outcome: "READ",
    url,
    facts: {
      finalUrl: `${url}/`,
      title: "Kopi Lab | Specialty coffee",
      description: "Single-origin coffee on Amoy Street",
      imageUrl: null,
    },
  };
  return Promise.resolve(reading);
};

export function testDeps(overrides: Partial<ApiDeps> = {}): ApiDeps {
  return {
    db,
    appBaseUrl,
    operatorKey,
    assetDir,
    evidenceDir,
    planner: fixturePlanner(plannerFixture("plan-accepted")),
    receiptReader: null,
    rates: testRates,
    readBrandPage: readKopiLabPage,
    ...overrides,
  };
}

export type TestApp = ReturnType<typeof createApp>;

export const app = createApp(testDeps());

const allTables = [
  campaignReceipts,
  interventions,
  remediationDecisions,
  masumiPaymentEvidence,
  scanEvents,
  auditEvents,
  evidence,
  expenses,
  physicalTasks,
  runners,
  approvals,
  campaignAssets,
  spots,
  campaigns,
  brandPlaybooks,
  brands,
];

export async function emptyDatabase(): Promise<void> {
  await db.execute(sql`truncate ${sql.join(allTables, sql`, `)} cascade`);
}

export function resetDatabaseBetweenTests(): void {
  beforeEach(emptyDatabase);
  afterAll(async () => {
    await db.$client.end();
  });
}

export interface Reply<Body> {
  readonly status: number;
  readonly body: Body;
}

export async function callApp<Body>(
  target: TestApp,
  method: string,
  path: string,
  payload?: unknown,
): Promise<Reply<Body>> {
  const response = await target.request(path, {
    method,
    headers: { "content-type": "application/json" },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const body: unknown = await response.json();
  return { status: response.status, body: body as Body };
}

export async function call<Body>(
  method: string,
  path: string,
  payload?: unknown,
): Promise<Reply<Body>> {
  return callApp<Body>(app, method, path, payload);
}

export function briefBody(overrides: Partial<CreateCampaignRequest> = {}): CreateCampaignRequest {
  return {
    brandName: "Kopi Lab",
    brandUrl: "https://kopilab.example",
    message: "Show this card for a free oat flat white",
    destinationUrl: "https://kopilab.example/offer",
    spots: [
      { code: "B", name: "Telok Ayer notice board", instructions: "Pin at eye level" },
      { code: "A", name: "Amoy Street cafe window", instructions: "Tape inside the glass" },
    ],
    deadline: new Date(Date.now() + 86_400_000).toISOString(),
    budget: { amount: "50.00", currency: "SGD" },
    ...overrides,
  };
}

export async function createCampaign(
  overrides: Partial<CreateCampaignRequest> = {},
): Promise<CampaignView> {
  const reply = await call<CampaignView>("POST", "/campaigns", briefBody(overrides));
  if (reply.status !== 201) {
    throw new Error(`Creating a campaign failed with ${String(reply.status)}`);
  }
  return reply.body;
}
