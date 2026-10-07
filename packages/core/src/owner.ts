import { canonicalJson } from "./canonical";
import type { IsoTimestamp, PublicCopy } from "./contract";
import type { CampaignView, WireMoney } from "./wire";

export const ownerSignatureScheme = "ECDSA-P256-SHA256";
export const ownerStatementVersion = "datum-owner-v1";

export interface ApproveStatement {
  readonly action: "APPROVE";
  readonly campaignId: string;
  readonly assetVersion: number;
  readonly assetHash: string;
  readonly spotsHash: string;
  readonly copy: PublicCopy;
  readonly budget: WireMoney;
  readonly deadline: IsoTimestamp;
  readonly approvedBy: string;
}

export interface RaiseBudgetStatement {
  readonly action: "RAISE_BUDGET";
  readonly campaignId: string;
  readonly approvalVersion: number;
  readonly budget: WireMoney;
  readonly approvedBy: string;
}

export interface AcceptExpenseStatement {
  readonly action: "ACCEPT_EXPENSE";
  readonly campaignId: string;
  readonly expenseId: string;
  readonly amount: WireMoney;
  readonly acceptedBy: string;
  readonly reason: string;
}

export type OwnerStatement = ApproveStatement | RaiseBudgetStatement | AcceptExpenseStatement;

const money = (value: WireMoney) => ({ amount: value.amount, currency: value.currency });

const fields = (statement: OwnerStatement) => {
  switch (statement.action) {
    case "APPROVE":
      return {
        ...statement,
        copy: { headline: statement.copy.headline, subcopy: statement.copy.subcopy },
        budget: money(statement.budget),
      };
    case "RAISE_BUDGET":
      return { ...statement, budget: money(statement.budget) };
    case "ACCEPT_EXPENSE":
      return { ...statement, amount: money(statement.amount) };
  }
};

export const ownerStatementText = (statement: OwnerStatement): string =>
  canonicalJson({
    scheme: ownerSignatureScheme,
    version: ownerStatementVersion,
    ...fields(statement),
  });

export function approveStatementFor(view: CampaignView, approvedBy: string): ApproveStatement {
  if (view.proposal === null) throw new Error(`Campaign ${view.id} has no proposal to approve`);
  return {
    action: "APPROVE",
    campaignId: view.id,
    assetVersion: view.proposal.assetVersion,
    assetHash: view.proposal.assetHash,
    spotsHash: view.proposal.spotsHash,
    copy: view.proposal.copy,
    budget: view.budget,
    deadline: view.deadline,
    approvedBy,
  };
}

export function raiseBudgetStatementFor(
  view: CampaignView,
  budget: WireMoney,
  approvedBy: string,
): RaiseBudgetStatement {
  if (view.approval === null) throw new Error(`Campaign ${view.id} was never approved`);
  return {
    action: "RAISE_BUDGET",
    campaignId: view.id,
    approvalVersion: view.approval.version,
    budget,
    approvedBy,
  };
}

export function acceptExpenseStatementFor(
  view: CampaignView,
  expenseId: string,
  acceptedBy: string,
  reason: string,
): AcceptExpenseStatement {
  const expense = view.ledger?.expenses.find((candidate) => candidate.id === expenseId);
  if (expense === undefined) throw new Error(`Campaign ${view.id} has no expense ${expenseId}`);
  return {
    action: "ACCEPT_EXPENSE",
    campaignId: view.id,
    expenseId,
    amount: expense.amount,
    acceptedBy,
    reason,
  };
}
