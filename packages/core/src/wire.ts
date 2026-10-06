import type {
  AuditEventType,
  CampaignStatus,
  Currency,
  EvidenceFailure,
  EvidencePolicy,
  EvidenceVerdict,
  ExecutorAdapter,
  ExpenseStatus,
  IsoTimestamp,
  PhysicalTaskStatus,
  PhysicalTaskType,
  PrintFormat,
  PublicCopy,
  SpotCode,
  SpotDraft,
  SpotOutcome,
} from "./contract";

export type MoneyText = string;

export interface WireMoney {
  amount: MoneyText;
  currency: Currency;
}

export interface ApiError {
  error: string;
  message: string;
}

export interface CreateCampaignRequest {
  brandName: string;
  brandUrl: string | null;
  message: string;
  destinationUrl: string;
  spots: SpotDraft[];
  deadline: IsoTimestamp;
  budget: WireMoney;
}

export interface ApproveCampaignRequest {
  assetVersion: number;
  approvedBy: string;
}

export interface EditCopyRequest {
  copy: PublicCopy;
}

export interface RaiseBudgetRequest {
  budget: WireMoney;
  approvedBy: string;
}

export interface AcceptExpenseRequest {
  acceptedBy: string;
  reason: string;
}

export type PlanStep =
  | { type: "PRINT_AND_COLLECT"; quantity: number; estimatedCost: WireMoney }
  | { type: "PLACE_SPOT"; spotCode: SpotCode; estimatedCost: WireMoney };

export interface PlaybookView {
  brandId: string;
  version: number;
  website: string | null;
  approvedLogoUrl: string | null;
  approvedTagline: string | null;
  defaultPrintFormat: PrintFormat;
  maxAutonomousPhysicalSpend: WireMoney;
  forbiddenClaims: string[];
  notes: string[];
}

export interface ProposalView {
  assetVersion: number;
  assetHash: string;
  copy: PublicCopy;
  printFormat: PrintFormat;
  steps: PlanStep[];
  estimatedSpend: WireMoney;
  evidencePolicy: EvidencePolicy;
  assumptions: string[];
  customerWarnings: string[];
  plannedBy: { model: string };
  createdAt: IsoTimestamp;
}

export interface SpotCardView {
  pngUrl: string;
  pdfUrl: string;
}

export interface SpotView {
  id: string;
  code: SpotCode;
  name: string;
  instructions: string;
  qrTargetUrl: string;
  status: SpotOutcome;
  firstPassStatus: SpotOutcome;
  scanCount: number;
  card: SpotCardView | null;
  latestEvidence: EvidenceView | null;
}

export interface ApprovalView {
  version: number;
  assetVersion: number;
  assetHash: string;
  spotsHash: string;
  copy: PublicCopy;
  budget: WireMoney;
  deadline: IsoTimestamp;
  evidencePolicy: EvidencePolicy;
  approvedBy: string;
  approvedAt: IsoTimestamp;
  current: boolean;
}

export interface CampaignView {
  id: string;
  status: CampaignStatus;
  brand: { id: string; name: string; website: string | null };
  message: string;
  destinationUrl: string;
  deadline: IsoTimestamp;
  budget: WireMoney;
  createdAt: IsoTimestamp;
  approvedAt: IsoTimestamp | null;
  completedAt: IsoTimestamp | null;
  playbook: PlaybookView | null;
  proposal: ProposalView | null;
  approval: ApprovalView | null;
  spots: SpotView[];
  tasks: TaskSummaryView[];
  ledger: LedgerView | null;
}

export const timelineActors = ["CUSTOMER", "DATUM_AI", "DATUM_RULES", "RUNNER", "MASUMI"] as const;
export type TimelineActor = (typeof timelineActors)[number];

export interface TimelineEventView {
  id: string;
  type: AuditEventType;
  actor: TimelineActor;
  summary: string;
  at: IsoTimestamp;
}

export interface EvidenceCheckView {
  photoReceived: boolean;
  qrDetected: boolean;
  campaignMatches: boolean;
  spotMatches: boolean;
  taskOpen: boolean;
  beforeDeadline: boolean;
}

export interface EvidenceView {
  id: string;
  taskId: string;
  spotCode: SpotCode | null;
  photoUrl: string;
  submittedAt: IsoTimestamp;
  verdict: EvidenceVerdict | null;
  failure: EvidenceFailure | null;
  explanation: string;
  checks: EvidenceCheckView;
}

export interface ExpenseView {
  id: string;
  taskId: string;
  amount: WireMoney;
  merchant: string | null;
  status: ExpenseStatus;
  receiptUrl: string;
  explanation: string;
}

export interface AgreedFeeView {
  id: string;
  taskId: string;
  spotCode: SpotCode;
  attempt: number;
  amount: WireMoney;
  merchant: string;
  status: ExpenseStatus;
  explanation: string;
  recordedAt: IsoTimestamp;
}

export interface LedgerView {
  approvedBudget: WireMoney;
  confirmedSpend: WireMoney;
  committedSpend: WireMoney;
  remaining: WireMoney;
  expenses: ExpenseView[];
  agreedFees?: AgreedFeeView[];
}

export interface TaskSummaryView {
  id: string;
  type: PhysicalTaskType;
  spotCode: SpotCode | null;
  attempt: number;
  status: PhysicalTaskStatus;
  adapter: ExecutorAdapter;
  dueBy: IsoTimestamp;
  createdAt: IsoTimestamp;
}

export interface RunnerTaskView {
  id: string;
  campaignId: string;
  brandName: string;
  type: PhysicalTaskType;
  attempt: number;
  status: PhysicalTaskStatus;
  spot: { code: SpotCode; name: string; instructions: string } | null;
  instructions: string;
  cards: SpotCardView[];
  dueBy: IsoTimestamp;
  estimatedCost: WireMoney;
  evidence: EvidenceView[];
  expense: ExpenseView | null;
}

export interface RunnerInboxView {
  runner: { id: string; name: string };
  tasks: RunnerTaskView[];
}

export interface EnrollRunnerRequest {
  name: string;
  expiresAt: IsoTimestamp;
}

export interface OperatorRunnerView {
  id: string;
  name: string;
  active: boolean;
  expiresAt: IsoTimestamp;
  createdAt: IsoTimestamp;
}

export interface EnrolledRunnerView {
  runner: OperatorRunnerView;
  inboxUrl: string;
}
