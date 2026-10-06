import { sql } from "drizzle-orm";
import { brands, type BrandRow, type Executor } from "@datum/db";

export async function ensureBrand(
  db: Executor,
  name: string,
  website: string | null,
): Promise<BrandRow> {
  await db.insert(brands).values({ name, website }).onConflictDoNothing();
  const [brand] = await db
    .select()
    .from(brands)
    .where(sql`lower(${brands.name}) = lower(${name})`);
  if (brand === undefined) {
    throw new Error(`Brand ${name} is missing right after it was ensured`);
  }
  return brand;
}
