import type {
  AuditEventType,
  CampaignStatus,
  Currency,
  EvidencePolicy,
  IsoTimestamp,
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
