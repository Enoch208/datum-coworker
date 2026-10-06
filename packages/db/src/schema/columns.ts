import { bigint, text, timestamp } from "drizzle-orm/pg-core";
import { newId, type IdPrefix } from "../ids";

export const primaryId = (prefix: IdPrefix) =>
  text("id")
    .primaryKey()
    .$defaultFn(() => newId(prefix));

export const minorUnits = (name: string) => bigint(name, { mode: "number" });

export const instant = (name: string) => timestamp(name, { withTimezone: true });

export const createdAt = () => instant("created_at").notNull().defaultNow();
