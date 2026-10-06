import { pgEnum } from "drizzle-orm/pg-core";
import {
  auditEventTypes,
  campaignStatuses,
  currencies,
  evidenceFailures,
  evidencePolicies,
  evidenceVerdicts,
  executorAdapters,
  expenseKinds,
  expenseStatuses,
  interventionActions,
  interventionActors,
  physicalTaskStatuses,
  physicalTaskTypes,
  printFormats,
  spotOutcomes,
} from "@datum/core";

export const campaignStatus = pgEnum("campaign_status", campaignStatuses);
export const spotOutcome = pgEnum("spot_outcome", spotOutcomes);
export const physicalTaskType = pgEnum("physical_task_type", physicalTaskTypes);
export const physicalTaskStatus = pgEnum("physical_task_status", physicalTaskStatuses);
export const executorAdapter = pgEnum("executor_adapter", executorAdapters);
export const expenseStatus = pgEnum("expense_status", expenseStatuses);
export const expenseKind = pgEnum("expense_kind", expenseKinds);
export const interventionActor = pgEnum("intervention_actor", interventionActors);
export const interventionAction = pgEnum("intervention_action", interventionActions);
export const evidenceVerdict = pgEnum("evidence_verdict", evidenceVerdicts);
export const evidenceFailure = pgEnum("evidence_failure", evidenceFailures);
export const currency = pgEnum("currency", currencies);
export const auditEventType = pgEnum("audit_event_type", auditEventTypes);
export const printFormat = pgEnum("print_format", printFormats);
export const evidencePolicy = pgEnum("evidence_policy", evidencePolicies);
