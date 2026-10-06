import type { PlannerModel, PlannerPrompt } from "@datum/api/campaign-service";
import type { BriefOutput } from "../../src/brief/schema";

export const briefModelId = "claude-sonnet-5-5";

export const futureDeadline = (hours = 3): string =>
  new Date(Date.now() + hours * 3_600_000).toISOString().replace("Z", "+00:00");

export const completeBrief = (deadline = futureDeadline()): BriefOutput => ({
  brandName: "Kopi Lab",
  brandUrl: "https://kopilab.example",
  message: "Show this card for a free oat flat white",
  destinationUrl: "https://kopilab.example/offer",
  spots: [
    { name: "Amoy Street cafe window", instructions: "Tape inside the glass" },
    { name: "Telok Ayer notice board", instructions: "Pin at eye level" },
  ],
  deadline,
  budgetSgd: "50.00",
});

export const briefWithoutDeadlineOrBudget = (): BriefOutput => ({
  ...completeBrief(),
  deadline: null,
  budgetSgd: null,
});

export interface ScriptedBriefModel extends PlannerModel {
  readonly prompts: PlannerPrompt[];
  answer: BriefOutput;
}

export function scriptedBriefModel(answer: BriefOutput): ScriptedBriefModel {
  const prompts: PlannerPrompt[] = [];
  const model: ScriptedBriefModel = {
    prompts,
    answer,
    propose(prompt) {
      prompts.push(prompt);
      return Promise.resolve({ model: briefModelId, output: model.answer });
    },
  };
  return model;
}
