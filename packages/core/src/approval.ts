import type { ApprovalLock } from "./contract";

export type ExecutionBlock = "NO_APPROVAL" | "APPROVAL_NOT_CURRENT";

export class ExecutionBlockedError extends Error {
  readonly code: ExecutionBlock;

  constructor(code: ExecutionBlock, message: string) {
    super(message);
    this.name = "ExecutionBlockedError";
    this.code = code;
  }
}

export const isApprovalCurrent = (approval: ApprovalLock, currentAssetVersion: number): boolean =>
  approval.assetVersion === currentAssetVersion;

export const assertExecutable = (
  approval: ApprovalLock | null,
  currentAssetVersion: number,
): ApprovalLock => {
  if (approval === null) {
    throw new ExecutionBlockedError(
      "NO_APPROVAL",
      "Nothing physical starts before the customer approves",
    );
  }
  if (!isApprovalCurrent(approval, currentAssetVersion)) {
    throw new ExecutionBlockedError(
      "APPROVAL_NOT_CURRENT",
      `The approval covers asset version ${String(approval.assetVersion)}, but version ${String(currentAssetVersion)} is current`,
    );
  }
  return approval;
};
