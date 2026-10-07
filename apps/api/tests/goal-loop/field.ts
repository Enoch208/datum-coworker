import type {
  CampaignView,
  CreateCampaignRequest,
  EvidenceView,
  RunnerTaskView,
  SpotDraft,
} from "@datum/core";
import sharp from "sharp";
import { expect } from "vitest";
import { createApp } from "../../src/app";
import type { PlannerModel } from "../../src/planner/model";
import { fixturePlanner } from "../planner/fixture-model";
import { taskFor, type StartedCampaign } from "../runners/campaign";
import { jpegFile, phonePhoto, postForm, runnerCall, taskPath } from "../runners/calls";
import { enrollTestRunner } from "../runners/enroll";
import { campaignNow, finishPrint } from "../runners/print";
import { signedApproval } from "../flows";
import { briefBody, callApp, testDeps } from "../support";
import { runPass } from "./loop";

const places: Readonly<Record<string, string>> = {
  A: "Amoy Street cafe window",
  B: "Telok Ayer notice board",
  C: "Far East Square community board",
  D: "Club Street co-working lobby",
};

const spotDrafts = (codes: readonly string[]): SpotDraft[] =>
  codes.map((code) => ({
    code,
    name: places[code] ?? `Spot ${code}`,
    instructions: "Pin at eye level",
  }));

export const fieldPlan = (codes: readonly string[]) => ({
  headline: "Your oat flat white is on us",
  subcopy:
    "Scan the code, show this card at Kopi Lab on Amoy Street and get a free oat flat white.",
  printFormat: "A6",
  assumptions: [],
  customerWarnings: [],
  steps: [
    { type: "PRINT_AND_COLLECT", quantity: codes.length },
    ...codes.map((spotCode) => ({ type: "PLACE_SPOT", spotCode })),
  ],
});

export interface FieldCampaign extends StartedCampaign {
  readonly codes: readonly string[];
}

export async function fieldCampaign(
  codes: readonly string[],
  budget: string,
  overrides: Partial<CreateCampaignRequest> = {},
): Promise<FieldCampaign> {
  const planner: PlannerModel = fixturePlanner(fieldPlan(codes));
  const target = createApp(testDeps({ planner }));
  const runner = await enrollTestRunner();
  const brief = briefBody({
    spots: spotDrafts(codes),
    budget: { amount: budget, currency: "SGD" },
    ...overrides,
  });
  const created = await callApp<CampaignView>(target, "POST", "/campaigns", brief);
  const id = created.body.id;
  expect((await callApp(target, "POST", `/campaigns/${id}/plan`)).status).toBe(200);
  const approved = await callApp(
    target,
    "POST",
    `/campaigns/${id}/approve`,
    await signedApproval(id, 1),
  );
  expect(approved.status).toBe(200);
  const started = await callApp<CampaignView>(target, "POST", `/campaigns/${id}/start`);
  expect(started.body.status).toBe("EXECUTING");
  const printing = { campaign: started.body, runner };
  const print = codes.length * 150;
  expect((await finishPrint(printing, (print / 100).toFixed(2))).status).toBe(200);
  expect((await runPass()).failed).toEqual([]);
  return { campaign: await campaignNow(id), runner, codes };
}

export async function refreshed(field: FieldCampaign): Promise<FieldCampaign> {
  return { ...field, campaign: await campaignNow(field.campaign.id) };
}

const noCodePhoto = (): Promise<Buffer> =>
  sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#6b7d5a" } })
    .jpeg({ quality: 85 })
    .toBuffer();

const currentTask = (campaign: CampaignView, spotCode: string) =>
  campaign.tasks.findLast((task) => task.spotCode === spotCode && task.type === "PLACE_SPOT") ??
  taskFor(campaign, spotCode);

async function sendPhoto(field: FieldCampaign, spotCode: string, photo: Buffer) {
  const { campaign } = await refreshed(field);
  const taskId = currentTask(campaign, spotCode).id;
  const { token } = field.runner;
  await runnerCall("POST", taskPath(token, taskId, "accept"));
  const sent = await postForm<EvidenceView>(taskPath(token, taskId, "evidence"), {
    photo: jpegFile(photo),
  });
  return { taskId, sent };
}

export async function placeAndProve(field: FieldCampaign, spotCode: string, seed = 1) {
  const { sent } = await sendPhoto(
    field,
    spotCode,
    await phonePhoto(field.campaign, spotCode, { seed }),
  );
  expect(sent.body.verdict).toBe("PASS");
  return sent.body;
}

export async function markDoneWithoutValidPhoto(field: FieldCampaign, spotCode: string) {
  const { taskId, sent } = await sendPhoto(field, spotCode, await noCodePhoto());
  expect(sent.body).toMatchObject({ verdict: "FAIL", failure: "QR_NOT_FOUND" });
  const done = await runnerCall<RunnerTaskView>(
    "POST",
    taskPath(field.runner.token, taskId, "complete"),
  );
  expect(done.body.status).toBe("COMPLETED");
}
