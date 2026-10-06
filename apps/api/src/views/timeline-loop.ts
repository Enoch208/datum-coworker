import {
  formatMoney,
  interventionActors,
  remediationRejections,
  type UnresolvedReason,
} from "@datum/core";
import { z } from "zod";
import { describe, moneyPayload as money, plural, type Describers } from "./describe";
import { gapWords } from "./reasons";

const reason: z.ZodType<UnresolvedReason> = z.custom<UnresolvedReason>(
  (value) => typeof value === "object" && value !== null && "kind" in value,
);

const spotList = (codes: readonly string[]): string =>
  codes.length === 1
    ? `Spot ${codes[0] ?? ""}`
    : `Spots ${codes.slice(0, -1).join(", ")} and ${codes.at(-1) ?? ""}`;

const cause = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("REJECTED"),
    reason: z.enum(remediationRejections),
    spotCode: z.string().nullable(),
  }),
  z.object({ kind: z.literal("PLANNER_FAILED"), code: z.string(), detail: z.string() }),
  z.object({ kind: z.literal("NO_PLANNER") }),
]);

const causeWords = (value: z.output<typeof cause>): string => {
  switch (value.kind) {
    case "REJECTED":
      return `Rules rejected the proposed recovery (${value.reason}${value.spotCode === null ? "" : `, Spot ${value.spotCode}`})`;
    case "PLANNER_FAILED":
      return `The recovery planner did not answer usefully (${value.code})`;
    case "NO_PLANNER":
      return "No recovery planner is configured";
  }
};

const trip = z.object({ spotCodes: z.array(z.string()), dueInMinutes: z.int() });

const tripWords = (value: z.output<typeof trip>): string =>
  `${spotList(value.spotCodes)} within ${plural(value.dueInMinutes, "minute")}`;

export const loopDescribers: Describers = {
  RECEIPT_PUBLISHED: describe(
    z.object({
      sha256: z.string(),
      spotsPassed: z.int(),
      required: z.int(),
      firstPassPassed: z.int(),
      recoveries: z.int(),
      interventions: z.int(),
      spend: money,
    }),
    "DATUM_RULES",
    (p) =>
      `Published the Campaign Receipt: ${String(p.spotsPassed)} of ${plural(p.required, "spot")} live, ${String(p.firstPassPassed)} on the first pass, ${plural(p.recoveries, "recovery", "recoveries")}, ${plural(p.interventions, "post-approval intervention")}, ${formatMoney(p.spend)} spent (sha256 ${p.sha256.slice(0, 12)})`,
  ),
  INTERVENTION_RECORDED: describe(
    z.object({
      actor: z.enum(interventionActors),
      actorName: z.string(),
      reason: z.string(),
    }),
    "DATUM_RULES",
    (p) =>
      `Counted a post-approval intervention: ${p.actorName} (${p.actor === "CUSTOMER" ? "customer" : "operator"}) ${p.reason}`,
  ),
  GOAL_EVALUATED: describe(
    z.object({ passed: z.int(), required: z.int() }),
    "DATUM_RULES",
    (p) => `${String(p.passed)} of ${plural(p.required, "spot")} verified`,
  ),
  GAP_DETECTED: describe(
    z.object({ spotCode: z.string(), reason }),
    "DATUM_RULES",
    (p) => `Spot ${p.spotCode} unresolved: ${gapWords(p.reason)}`,
  ),
  REMEDIATION_PROPOSED: describe(
    z.object({ model: z.string(), actions: z.array(trip), rationale: z.string() }),
    "DATUM_AI",
    (p) =>
      `${p.model} proposed ${plural(p.actions.length, "recovery trip")}: ${p.actions.map(tripWords).join("; ")}. ${p.rationale}`,
  ),
  REMEDIATION_FALLBACK: describe(
    z.object({ cause, spotCodes: z.array(z.string()) }),
    "DATUM_RULES",
    (p) =>
      `${causeWords(p.cause)}, so Datum used its standard recovery: one placement each for ${spotList(p.spotCodes)}`,
  ),
  RECOVERY_CREATED: describe(
    z.object({
      spotCodes: z.array(z.string()),
      remainingBefore: money,
      minutesToDeadline: z.int(),
    }),
    "DATUM_RULES",
    (p) =>
      `Recovery ${p.spotCodes.length === 1 ? "task" : "trip"} for ${spotList(p.spotCodes)} dispatched within ${formatMoney(p.remainingBefore)} remaining and ${plural(p.minutesToDeadline, "minute")} to the deadline`,
  ),
};

export const recoveryOverBudget = z.object({
  reason: z.literal("RECOVERY_OVER_BUDGET"),
  spotCodes: z.array(z.string()),
  planCost: money,
  remaining: money,
  budget: money,
  shortfall: money,
  revisedMaximum: money,
});

export const recoveryOverBudgetWords = (p: z.output<typeof recoveryOverBudget>): string =>
  `Stopped before recovering ${spotList(p.spotCodes)}: the recovery needs ${formatMoney(p.planCost)} but only ${formatMoney(p.remaining)} of the ${formatMoney(p.budget)} budget remains, so raising the cap to ${formatMoney(p.revisedMaximum)} needs the customer's approval`;
