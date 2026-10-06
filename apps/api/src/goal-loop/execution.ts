import {
  checkBudget,
  confirmedSpend,
  isOpenTaskStatus,
  printKey,
  sumMoney,
  type Money,
  type PhysicalTaskDraft,
} from "@datum/core";
import { recordAudit } from "../services/audit";
import { recordUnlessRepeated } from "./once";
import { campaignParts } from "../services/campaigns";
import type { BudgetStage } from "../services/execution-audit";
import {
  budgetPositionOf,
  executableOf,
  isPrintDraft,
  plannedDrafts,
  type Executable,
} from "../services/execution-plan";
import { moveStatus } from "../services/status";
import type { CampaignParts } from "../views/campaigns";
import { commissionTask } from "./commission";
import type { LoopDeps } from "./deps";

export type ExecutionProgress =
  "AWAITING_PRINT" | "AWAITING_RUNNER" | "COMMISSIONED" | "PLACEMENTS_OUT" | "NEEDS_APPROVAL";

interface Stage {
  readonly name: BudgetStage;
  readonly estimate: readonly PhysicalTaskDraft[];
  readonly create: readonly PhysicalTaskDraft[];
}

const total = (drafts: readonly PhysicalTaskDraft[], budget: Money): Money =>
  sumMoney(
    drafts.map((draft) => draft.estimatedCost),
    budget.currency,
  );

async function requestApproval(
  deps: LoopDeps,
  campaignId: string,
  facts: { tasks: number; estimated: Money; confirmedSpend: Money; committedSpend: Money },
  budget: Money,
  shortfall: Money,
  stage: BudgetStage,
): Promise<void> {
  await deps.db.transaction(async (tx) => {
    await moveStatus(tx, campaignId, "EXECUTING", "NEEDS_APPROVAL");
    await recordAudit(tx, campaignId, {
      type: "APPROVAL_REQUESTED",
      payload:
        stage === "PLAN"
          ? { reason: "OVER_BUDGET", estimated: facts.estimated, budget, shortfall }
          : {
              reason: stage === "PRINT_RETRY" ? "REPRINT_OVER_BUDGET" : "PLACEMENTS_OVER_BUDGET",
              ...facts,
              budget,
              shortfall,
            },
    });
  });
}

async function commissionStage(
  deps: LoopDeps,
  parts: CampaignParts,
  target: Executable,
  stage: Stage,
  signal: AbortSignal,
): Promise<ExecutionProgress> {
  const campaignId = parts.campaign.id;
  const budget = target.lock.budget;
  const position = budgetPositionOf(parts, budget);
  const facts = {
    tasks: stage.estimate.length,
    estimated: total(stage.estimate, budget),
    confirmedSpend: confirmedSpend(position.expenses, budget.currency),
    committedSpend: position.committedOpenSpend,
  };
  const decision = checkBudget({ ...position, estimatedActionCost: facts.estimated });
  if (decision.decision === "NEEDS_APPROVAL") {
    await requestApproval(deps, campaignId, facts, budget, decision.shortfall, stage.name);
    return "NEEDS_APPROVAL";
  }
  await recordUnlessRepeated(deps.db, campaignId, {
    type: "BUDGET_CHECKED",
    payload: { stage: stage.name, ...facts, budget },
  });
  for (const draft of stage.create) {
    if (!(await commissionTask(deps, draft))) return "AWAITING_RUNNER";
    signal.throwIfAborted();
  }
  return "COMMISSIONED";
}

const printTasks = (parts: CampaignParts) =>
  parts.tasks.filter(({ task }) => task.type === "PRINT_AND_COLLECT").map(({ task }) => task);

const printSettled = (parts: CampaignParts): boolean =>
  printTasks(parts).some(
    (task) =>
      task.status === "COMPLETED" &&
      parts.expenses.some(
        (expense) => expense.physicalTaskId === task.id && expense.status === "CONFIRMED",
      ),
  );

const nextPrint = (parts: CampaignParts, print: PhysicalTaskDraft): PhysicalTaskDraft => {
  const attempt = printTasks(parts).length + 1;
  return { ...print, attempt, idempotencyKey: printKey(parts.campaign.id, attempt) };
};

export async function advanceExecution(
  deps: LoopDeps,
  campaignId: string,
  signal: AbortSignal,
): Promise<ExecutionProgress> {
  const parts = await campaignParts(deps.db, campaignId);
  const target = executableOf(parts);
  const keys = new Set(parts.tasks.map(({ task }) => task.idempotencyKey));
  const drafts = plannedDrafts(parts, target, deps.appBaseUrl);
  const unsent = drafts.filter((draft) => !isPrintDraft(draft) && !keys.has(draft.idempotencyKey));
  if (!printSettled(parts)) {
    if (printTasks(parts).some((task) => isOpenTaskStatus(task.status))) return "AWAITING_PRINT";
    const [print] = drafts.filter(isPrintDraft);
    if (print === undefined) throw new Error(`Campaign ${campaignId} has no print step`);
    const reprint = nextPrint(parts, print);
    return commissionStage(
      deps,
      parts,
      target,
      {
        name: reprint.attempt === 1 ? "PLAN" : "PRINT_RETRY",
        estimate: [reprint, ...unsent],
        create: [reprint],
      },
      signal,
    );
  }
  if (unsent.length === 0) return "PLACEMENTS_OUT";
  return commissionStage(
    deps,
    parts,
    target,
    { name: "PLACEMENTS", estimate: unsent, create: unsent },
    signal,
  );
}
