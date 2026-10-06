import { currencies, type AuditEventType, type TimelineActor } from "@datum/core";
import { z } from "zod";

export interface Description {
  readonly actor: TimelineActor;
  readonly summary: string;
}

export type Describer = (payload: unknown) => Description;

export type Describers = Partial<Record<AuditEventType, Describer>>;

export const moneyPayload = z.object({ amountMinor: z.int(), currency: z.enum(currencies) });

export const plural = (count: number, noun: string): string =>
  `${String(count)} ${noun}${count === 1 ? "" : "s"}`;

export const describe =
  <Schema extends z.ZodType>(
    schema: Schema,
    actor: TimelineActor,
    summarize: (payload: z.output<Schema>) => string,
  ): Describer =>
  (payload) => ({ actor, summary: summarize(schema.parse(payload)) });
