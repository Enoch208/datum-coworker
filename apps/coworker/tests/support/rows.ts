import { eq } from "drizzle-orm";
import {
  campaignReceipts,
  campaigns,
  coworkerComments,
  coworkerTasks,
  masumiPaymentEvidence,
  physicalTasks,
  type CampaignRow,
  type CoworkerTaskRow,
} from "@datum/db";
import { db } from "./harness";

export const campaignsFor = (taskId: string): Promise<CampaignRow[]> =>
  db.select().from(campaigns).where(eq(campaigns.sokosumiTaskId, taskId));

export async function onlyCampaign(taskId: string): Promise<CampaignRow> {
  const rows = await campaignsFor(taskId);
  const [row] = rows;
  if (row === undefined || rows.length !== 1) {
    throw new Error(`Task ${taskId} has ${String(rows.length)} campaigns`);
  }
  return row;
}

export async function hireRow(taskId: string): Promise<CoworkerTaskRow | undefined> {
  const [row] = await db
    .select()
    .from(coworkerTasks)
    .where(eq(coworkerTasks.sokosumiTaskId, taskId));
  return row;
}

export const commentRows = (taskId: string) =>
  db.select().from(coworkerComments).where(eq(coworkerComments.sokosumiTaskId, taskId));

export const physicalTaskRows = (campaignId: string) =>
  db.select().from(physicalTasks).where(eq(physicalTasks.campaignId, campaignId));

export const receiptRows = (campaignId: string) =>
  db.select().from(campaignReceipts).where(eq(campaignReceipts.campaignId, campaignId));

export const evidenceRows = (taskId: string) =>
  db.select().from(masumiPaymentEvidence).where(eq(masumiPaymentEvidence.sokosumiTaskId, taskId));
