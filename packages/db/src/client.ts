import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(databaseUrl: string) {
  return drizzle({ client: postgres(databaseUrl), schema });
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Executor = Db | Tx;

export type BrandRow = typeof schema.brands.$inferSelect;
export type PlaybookRow = typeof schema.brandPlaybooks.$inferSelect;
export type CampaignRow = typeof schema.campaigns.$inferSelect;
export type SpotRow = typeof schema.spots.$inferSelect;
export type ApprovalRow = typeof schema.approvals.$inferSelect;
export type AuditEventRow = typeof schema.auditEvents.$inferSelect;
