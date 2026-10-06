import type { CampaignServiceDeps, PlannerModel } from "@datum/api/campaign-service";
import type { LoopDeps } from "@datum/api/goal-loop";
import type { Db } from "@datum/db";
import type {
  ChainReader,
  Clock,
  CoreClient,
  Journal,
  LifecycleConfig,
  PaymentNode,
} from "@datum/masumi";

export type CoworkerCore = Pick<
  CoreClient,
  "me" | "task" | "listTasks" | "confirmPersonalWorkspace" | "postEvent" | "receipt"
>;

export interface Coworker {
  readonly coworkerId: string;
  readonly db: Db;
  readonly core: CoworkerCore;
  readonly mps: PaymentNode;
  readonly chain: ChainReader;
  readonly journal: Journal;
  readonly clock: Clock;
  readonly config: LifecycleConfig;
  readonly campaigns: CampaignServiceDeps;
  readonly loop: LoopDeps;
  readonly briefModel: PlannerModel | null;
  readonly log: (line: string) => void;
}
