import { readFileSync } from "node:fs";
import { plannerModelId, type PlannerModel } from "../../src/planner/model";
import type { PlannerPrompt } from "../../src/planner/prompt";

export interface FixturePlanner extends PlannerModel {
  readonly prompts: PlannerPrompt[];
}

export function plannerFixture(name: string): unknown {
  const parsed: unknown = JSON.parse(
    readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"),
  );
  return parsed;
}

export function fixturePlanner(output: unknown, model: string = plannerModelId): FixturePlanner {
  const prompts: PlannerPrompt[] = [];
  return {
    prompts,
    propose(prompt) {
      prompts.push(prompt);
      return Promise.resolve({ model, output });
    },
  };
}
