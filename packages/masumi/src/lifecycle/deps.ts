import { setTimeout as delay } from "node:timers/promises";
import type { ChainReader } from "../chain/blockfrost";
import type { EvidenceStore } from "../evidence-store";
import type { PaymentNode } from "../mps/client";
import type { CoreClient } from "../sokosumi/client";
import type { Journal } from "./journal";

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => delay(ms),
};

export interface LifecycleConfig {
  readonly agentIdentifier: string;
  readonly supportedPaymentSourceIndex: number;
  readonly sellerAddress: string;
  readonly amountAtomic: string;
  readonly unit: string;
}

export interface WorkInput {
  readonly taskId: string;
  readonly name: string;
  readonly description: string | null;
  readonly inputHash: string;
}

export interface LifecycleDeps {
  readonly core: Pick<
    CoreClient,
    "me" | "task" | "confirmPersonalWorkspace" | "postEvent" | "receipt"
  >;
  readonly mps: PaymentNode;
  readonly chain: ChainReader;
  readonly journal: Journal;
  readonly evidence: EvidenceStore;
  readonly clock: Clock;
  readonly config: LifecycleConfig;
  readonly produceResult: (input: WorkInput) => string;
  readonly log: (line: string) => void;
}
