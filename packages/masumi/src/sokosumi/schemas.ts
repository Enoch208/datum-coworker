import { z } from "zod";

export const coworkerSchema = z.object({
  id: z.string(),
  archivedAt: z.string().nullable(),
  capabilities: z.array(z.string()),
});
export type Coworker = z.infer<typeof coworkerSchema>;

export const taskEventSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  createdAt: z.string(),
  status: z.string().nullable().optional(),
  comment: z.string().nullish(),
  actor: z.object({ type: z.string(), id: z.string() }).nullable(),
});
export type TaskEvent = z.infer<typeof taskEventSchema>;

export const taskListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  assigneeId: z.string().nullable(),
  ownerId: z.string(),
  organizationId: z.string().nullable(),
  workspace: z.object({ id: z.string(), organizationId: z.string().nullable() }),
});
export type TaskListItem = z.infer<typeof taskListItemSchema>;

export const taskSchema = taskListItemSchema.extend({ events: z.array(taskEventSchema) });
export type Task = z.infer<typeof taskSchema>;

export const workspaceSchema = z.object({ organizationId: z.string().nullable() });

export const taskReceiptSchema = z.object({
  blockchainIdentifier: z.string().nullable(),
  claimStatus: z.string().nullable(),
  onChainState: z.string().nullable(),
  settled: z.boolean(),
  txHash: z.string().nullable(),
  withdrawnForSeller: z.array(
    z.object({ unit: z.string().nullable(), amount: z.string().nullable() }),
  ),
});
export type TaskReceipt = z.infer<typeof taskReceiptSchema>;

export const coreErrorBodySchema = z.object({
  error: z.string(),
  message: z.string(),
  kind: z.string().optional(),
});

export interface MasumiPaymentPayload {
  readonly blockchainIdentifier: string;
  readonly identifierFromPurchaser: string;
  readonly agentIdentifier: string;
  readonly sellerVkey: string;
  readonly inputHash: string;
  readonly payByTime: string;
  readonly submitResultTime: string;
  readonly unlockTime: string;
  readonly externalDisputeUnlockTime: string;
  readonly Amounts: readonly { readonly amount: string; readonly unit: string }[];
  readonly paymentSourceType: "Web3CardanoV2";
  readonly supportedPaymentSourceIndex: number;
  readonly PaymentSource: {
    readonly network: "Preprod";
    readonly policyId: string;
    readonly smartContractAddress: string;
  };
}

export type TaskEventBody =
  | { readonly status: "RUNNING" }
  | { readonly comment: string; readonly masumiPayment: MasumiPaymentPayload }
  | { readonly status: "COMPLETED"; readonly comment: string }
  | { readonly comment: string }
  | { readonly status: StoppedTaskStatus; readonly comment: string };

export const stoppedTaskStatuses = ["INPUT_REQUIRED", "FAILED"] as const;
export type StoppedTaskStatus = (typeof stoppedTaskStatuses)[number];

export const taskPageSchema = z.object({
  data: z.array(taskListItemSchema),
  meta: z.object({
    pagination: z.object({ nextCursor: z.string().nullable() }).optional(),
  }),
});
