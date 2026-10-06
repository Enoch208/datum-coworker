import { z } from "zod";
import { signedTermsSchema } from "../terms";
import { collectionProofSchema } from "../verify";

export const outboundActions = [
  "start_task",
  "request_terms",
  "attach_payment",
  "submit_result",
  "complete_task",
] as const;
export type OutboundAction = (typeof outboundActions)[number];

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);

const historyEntry = z.object({ at: z.string(), event: z.string(), detail: z.string().nullable() });

const base = z.object({
  version: z.literal(1),
  taskId: z.string().min(1),
  nonce: z.string(),
  outbound: z.object({ action: z.enum(outboundActions), since: z.string() }).nullable(),
  history: z.array(historyEntry),
});

const newState = base.extend({ step: z.literal("new") });
const startedState = base.extend({
  step: z.literal("started"),
  task: z.object({ name: z.string(), description: z.string().nullable() }),
  inputHash: hex64,
});
const termsRequestedState = startedState.extend({
  step: z.literal("terms_requested"),
  terms: signedTermsSchema,
});
const paymentAttachedState = termsRequestedState.extend({
  step: z.literal("payment_attached"),
  paymentEventId: z.string().nullable(),
});
const fundsLockedState = paymentAttachedState.extend({
  step: z.literal("funds_locked"),
  escrowTxHash: z.string(),
});
const resultSavedState = fundsLockedState.extend({
  step: z.literal("result_saved"),
  result: z.object({ text: z.string().min(1), hash: hex64 }),
});
const resultSubmittedState = resultSavedState.extend({ step: z.literal("result_submitted") });
const resultConfirmedState = resultSubmittedState.extend({
  step: z.literal("result_confirmed"),
  resultTxHash: z.string(),
});
const taskCompletedState = resultConfirmedState.extend({
  step: z.literal("task_completed"),
  completionEventId: z.string().nullable(),
});
const collectedState = taskCompletedState.extend({
  step: z.literal("collected"),
  collectionTxHash: z.string(),
});
const verifiedState = collectedState.extend({
  step: z.literal("verified"),
  proof: collectionProofSchema,
});

export const lifecycleStateSchema = z.discriminatedUnion("step", [
  newState,
  startedState,
  termsRequestedState,
  paymentAttachedState,
  fundsLockedState,
  resultSavedState,
  resultSubmittedState,
  resultConfirmedState,
  taskCompletedState,
  collectedState,
  verifiedState,
]);

export type LifecycleState = z.infer<typeof lifecycleStateSchema>;
export type LifecycleStep = LifecycleState["step"];
export type StateAt<Step extends LifecycleStep> = Extract<LifecycleState, { step: Step }>;

export function initialState(taskId: string, nonce: string, at: string): StateAt<"new"> {
  return {
    version: 1,
    taskId,
    nonce,
    step: "new",
    outbound: null,
    history: [{ at, event: "created", detail: null }],
  };
}
