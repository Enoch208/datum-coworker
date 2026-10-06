import { sql } from "drizzle-orm";
import type { CampaignView, CreateCampaignRequest } from "@datum/core";
import {
  approvals,
  auditEvents,
  brandPlaybooks,
  brands,
  campaigns,
  createDb,
  evidence,
  expenses,
  masumiPaymentEvidence,
  physicalTasks,
  scanEvents,
  spots,
} from "@datum/db";
import { afterAll, beforeEach } from "vitest";
import { createApp } from "../src/app";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || !databaseUrl.endsWith("/datum_test")) {
  throw new Error("API tests must run against the datum_test database");
}

export const db = createDb(databaseUrl);
export const appBaseUrl = "https://datum.test";
export const app = createApp({ db, appBaseUrl });

const allTables = [
  masumiPaymentEvidence,
  scanEvents,
  auditEvents,
  evidence,
  expenses,
  physicalTasks,
  approvals,
  spots,
  campaigns,
  brandPlaybooks,
  brands,
];

export function resetDatabaseBetweenTests(): void {
  beforeEach(async () => {
    await db.execute(sql`truncate ${sql.join(allTables, sql`, `)} cascade`);
  });
  afterAll(async () => {
    await db.$client.end();
  });
}

export interface Reply<Body> {
  readonly status: number;
  readonly body: Body;
}

export async function call<Body>(
  method: string,
  path: string,
  payload?: unknown,
): Promise<Reply<Body>> {
  const response = await app.request(path, {
    method,
    headers: { "content-type": "application/json" },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const body: unknown = await response.json();
  return { status: response.status, body: body as Body };
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
