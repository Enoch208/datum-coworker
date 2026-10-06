import { desc, eq } from "drizzle-orm";
import { draftPlaybook, type BrandPageReading, type BrandPlaybook } from "@datum/core";
import {
  brandPlaybooks,
  type BrandRow,
  type CampaignRow,
  type Executor,
  type PlaybookRow,
} from "@datum/db";
import type { BrandPageReader } from "../brand-page/reader";

export interface PlaybookChoice {
  readonly playbook: BrandPlaybook;
  readonly reading: BrandPageReading | null;
}

const fromRow = (row: PlaybookRow, brand: BrandRow): BrandPlaybook => ({
  brandId: row.brandId,
  version: row.version,
  name: brand.name,
  website: brand.website,
  approvedLogoUrl: row.approvedLogoUrl,
  approvedTagline: row.approvedTagline,
  defaultPrintFormat: row.defaultPrintFormat,
  defaultEvidence: row.defaultEvidencePolicy,
  maxAutonomousPhysicalSpend: {
    amountMinor: row.maxAutonomousPhysicalSpendMinor,
    currency: row.currency,
  },
  forbiddenClaims: row.forbiddenClaims,
  notes: row.notes,
});

async function latestPlaybook(db: Executor, brandId: string): Promise<PlaybookRow | null> {
  const [row] = await db
    .select()
    .from(brandPlaybooks)
    .where(eq(brandPlaybooks.brandId, brandId))
    .orderBy(desc(brandPlaybooks.version))
    .limit(1);
  return row ?? null;
}

export async function choosePlaybook(
  db: Executor,
  brand: BrandRow,
  campaign: CampaignRow,
  readBrandPage: BrandPageReader,
): Promise<PlaybookChoice> {
  const existing = await latestPlaybook(db, brand.id);
  if (existing !== null) return { playbook: fromRow(existing, brand), reading: null };
  const reading = await readBrandPage(brand.website);
  const playbook = draftPlaybook({
    brandId: brand.id,
    brandName: brand.name,
    website: brand.website,
    message: campaign.message,
    budget: { amountMinor: campaign.budgetMinor, currency: campaign.currency },
    page: reading,
  });
  return { playbook, reading };
}

export async function saveDraftPlaybook(db: Executor, playbook: BrandPlaybook): Promise<void> {
  await db
    .insert(brandPlaybooks)
    .values({
      brandId: playbook.brandId,
      version: playbook.version,
      approvedLogoUrl: playbook.approvedLogoUrl,
      approvedTagline: playbook.approvedTagline,
      defaultPrintFormat: playbook.defaultPrintFormat,
      defaultEvidencePolicy: playbook.defaultEvidence,
      maxAutonomousPhysicalSpendMinor: playbook.maxAutonomousPhysicalSpend.amountMinor,
      currency: playbook.maxAutonomousPhysicalSpend.currency,
      forbiddenClaims: playbook.forbiddenClaims,
      notes: playbook.notes,
    })
    .onConflictDoNothing();
}
