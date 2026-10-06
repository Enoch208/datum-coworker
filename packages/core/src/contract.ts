export const campaignStatuses = [
  "DRAFT",
  "PLANNING",
  "AWAITING_APPROVAL",
  "APPROVED",
  "EXECUTING",
  "VERIFYING",
  "REMEDIATING",
  "COMPLETED",
  "EXPIRED_INCOMPLETE",
  "FAILED",
  "CANCELLED",
  "NEEDS_APPROVAL",
] as const;
export type CampaignStatus = (typeof campaignStatuses)[number];

export const goalLoopStopStatuses = [
  "COMPLETED",
  "EXPIRED_INCOMPLETE",
  "FAILED",
  "CANCELLED",
  "NEEDS_APPROVAL",
] as const satisfies readonly CampaignStatus[];
export type GoalLoopStopStatus = (typeof goalLoopStopStatuses)[number];

export const finalCampaignStatuses = [
  "COMPLETED",
  "EXPIRED_INCOMPLETE",
  "FAILED",
  "CANCELLED",
] as const satisfies readonly CampaignStatus[];
export type FinalCampaignStatus = (typeof finalCampaignStatuses)[number];

export const spotOutcomes = ["PENDING", "PASS", "MISS"] as const;
export type SpotOutcome = (typeof spotOutcomes)[number];

export const evidenceFailures = [
  "NO_EVIDENCE",
  "QR_NOT_FOUND",
  "QR_WRONG_CAMPAIGN",
  "QR_WRONG_SPOT",
  "LATE_EVIDENCE",
  "EXECUTOR_CANCELLED",
  "TASK_EXPIRED",
  "ADVISORY_REVIEW_REQUIRED",
] as const;
export type EvidenceFailure = (typeof evidenceFailures)[number];

export const evidenceVerdicts = ["PASS", "FAIL"] as const;
export type EvidenceVerdict = (typeof evidenceVerdicts)[number];

export const physicalTaskTypes = ["PRINT_AND_COLLECT", "PLACE_SPOT"] as const;
export type PhysicalTaskType = (typeof physicalTaskTypes)[number];

export const physicalTaskStatuses = [
  "CREATED",
  "DISPATCHED",
  "ACCEPTED",
  "SUBMITTED",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type PhysicalTaskStatus = (typeof physicalTaskStatuses)[number];

export const openTaskStatuses = [
  "CREATED",
  "DISPATCHED",
  "ACCEPTED",
  "SUBMITTED",
] as const satisfies readonly PhysicalTaskStatus[];

const openTaskStatusSet: ReadonlySet<PhysicalTaskStatus> = new Set(openTaskStatuses);

export const isOpenTaskStatus = (status: PhysicalTaskStatus): boolean =>
  openTaskStatusSet.has(status);

export const executorAdapters = ["LOCAL_ENROLLED_RUNNER", "RENTAHUMAN"] as const;
export type ExecutorAdapter = (typeof executorAdapters)[number];

export const expenseStatuses = ["SUBMITTED", "CONFIRMED", "DISPUTED"] as const;
export type ExpenseStatus = (typeof expenseStatuses)[number];

export const expenseKinds = ["RECEIPT", "AGREED_FEE"] as const;
export type ExpenseKind = (typeof expenseKinds)[number];

export const currencies = ["SGD"] as const;
export type Currency = (typeof currencies)[number];

export const printFormats = ["A5", "A6"] as const;
export type PrintFormat = (typeof printFormats)[number];

export const evidencePolicies = ["photo_with_decodable_spot_qr"] as const;
export type EvidencePolicy = (typeof evidencePolicies)[number];

export const auditEventTypes = [
  "CAMPAIGN_CREATED",
  "PLAN_GENERATED",
  "CAMPAIGN_APPROVED",
  "STATUS_CHANGED",
  "TASK_CREATED",
  "TASK_DISPATCHED",
  "TASK_ACCEPTED",
  "TASK_COMPLETED",
  "TASK_CANCELLED",
  "TASK_EXPIRED",
  "EVIDENCE_RECEIVED",
  "EVIDENCE_EVALUATED",
  "EXPENSE_SUBMITTED",
  "EXPENSE_CONFIRMED",
  "EXPENSE_DISPUTED",
  "BUDGET_CHECKED",
  "GOAL_EVALUATED",
  "GAP_DETECTED",
  "REMEDIATION_PROPOSED",
  "REMEDIATION_FALLBACK",
  "RECOVERY_CREATED",
  "APPROVAL_REQUESTED",
  "RECEIPT_PUBLISHED",
  "PLAYBOOK_DRAFTED",
  "PLAN_REJECTED",
  "PLAN_VALIDATED",
  "CARDS_RENDERED",
  "COPY_EDITED",
] as const;
export type AuditEventType = (typeof auditEventTypes)[number];

export type MinorUnits = number;
export type IsoTimestamp = string;
export type SpotCode = string;

export interface Money {
  amountMinor: MinorUnits;
  currency: Currency;
}

export interface BrandPlaybook {
  brandId: string;
  version: number;
  name: string;
  website: string | null;
  approvedLogoUrl: string | null;
  approvedTagline: string | null;
  defaultPrintFormat: PrintFormat;
  defaultEvidence: EvidencePolicy;
  maxAutonomousPhysicalSpend: Money;
  forbiddenClaims: string[];
  notes: string[];
}

export interface SpotDraft {
  code: SpotCode;
  name: string;
  instructions: string;
}

export interface CampaignBrief {
  brandName: string;
  brandUrl: string | null;
  message: string;
  destinationUrl: string;
  spots: SpotDraft[];
  deadline: IsoTimestamp;
  budget: Money;
}

export interface PublicCopy {
  headline: string;
  subcopy: string;
}

export interface ApprovalLock {
  campaignId: string;
  assetVersion: number;
  assetHash: string;
  spotsHash: string;
  approvedCopy: PublicCopy;
  budget: Money;
  deadline: IsoTimestamp;
  evidencePolicy: EvidencePolicy;
  approvedBy: string;
  approvedAt: IsoTimestamp;
}

export interface QrPayload {
  campaignId: string;
  spotCode: SpotCode;
}

export interface EvidenceChecks {
  photoPresent: boolean;
  qrDecodable: boolean;
  qrMatchesCampaign: boolean;
  qrMatchesSpot: boolean;
  taskOpen: boolean;
  beforeDeadline: boolean;
}

export interface EvidenceEvaluation {
  verdict: EvidenceVerdict;
  failure: EvidenceFailure | null;
  checks: EvidenceChecks;
  decoded: QrPayload | null;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracyM: number;
}

export interface PhysicalTaskDraft {
  campaignId: string;
  spotCode: SpotCode | null;
  type: PhysicalTaskType;
  attempt: number;
  idempotencyKey: string;
  copies: number | null;
  assetVersion: number;
  instructions: string;
  assetUrls: string[];
  estimatedCost: Money;
  dueBy: IsoTimestamp;
}

export interface ExecutorTaskRef {
  adapter: ExecutorAdapter;
  externalRef: string;
}

export interface ExecutorTaskState {
  status: PhysicalTaskStatus;
  updatedAt: IsoTimestamp;
}

export interface ExecutorEvidence {
  uploadId: string;
  contentHash: string;
  photoUrl: string;
  submittedAt: IsoTimestamp;
  claimedSpotCode: SpotCode | null;
  claimedAmount: Money | null;
  receiptUrl: string | null;
  optionalGeo: GeoPoint | null;
}

export interface CancelResult {
  cancelled: boolean;
}

export interface PhysicalExecutor {
  readonly adapter: ExecutorAdapter;
  estimate(task: PhysicalTaskDraft): Promise<Money>;
  createTask(task: PhysicalTaskDraft): Promise<ExecutorTaskRef>;
  getTask(ref: ExecutorTaskRef): Promise<ExecutorTaskState>;
  getEvidence(ref: ExecutorTaskRef): Promise<ExecutorEvidence[]>;
  cancelTask(ref: ExecutorTaskRef): Promise<CancelResult>;
}

export interface SpotReceiptLine {
  spotCode: SpotCode;
  name: string;
  firstPass: SpotOutcome;
  final: SpotOutcome;
  attempts: number;
  inducedMiss: boolean;
  scans: number;
  evidencePhotoUrl: string | null;
}

export interface MasumiPaymentEvidence {
  sokosumiTaskId: string;
  paymentId: string;
  blockchainIdentifier: string;
  resultHash: string;
  sellerAddress: string;
  tokenUnit: string;
  collectionTxHash: string | null;
  netReceivedAtomic: string | null;
  collectionConfirmed: boolean;
  verifiedAt: IsoTimestamp | null;
}

export interface CampaignReceipt {
  campaignId: string;
  campaignName: string;
  status: CampaignStatus;
  target: { spots: number; deadline: IsoTimestamp; budget: Money };
  actual: { spotsPassed: number; completedAt: IsoTimestamp | null; spend: Money };
  spots: SpotReceiptLine[];
  firstPassPassed: number;
  recoveryActions: number;
  postApprovalInterventions: number;
  executorAdapters: ExecutorAdapter[];
  totalScans: number;
  masumi: MasumiPaymentEvidence | null;
}
