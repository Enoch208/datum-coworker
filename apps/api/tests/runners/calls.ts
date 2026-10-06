import type { CampaignView } from "@datum/core";
import { assetBytes } from "../flows";
import { photographCard, plainScene, type Scene } from "../qr/scene";
import { app } from "../support";

export interface RunnerReply<Body> {
  readonly status: number;
  readonly body: Body;
}

async function replyOf<Body>(response: Response): Promise<RunnerReply<Body>> {
  const body: unknown = await response.json();
  return { status: response.status, body: body as Body };
}

export const runnerCall = async <Body>(method: string, path: string) =>
  replyOf<Body>(await app.request(path, { method }));

export const taskPath = (token: string, taskId: string, action: string) =>
  `/runner/${token}/tasks/${taskId}/${action}`;

export async function postForm<Body>(
  path: string,
  fields: Record<string, string | Blob>,
): Promise<RunnerReply<Body>> {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return replyOf<Body>(await app.request(path, { method: "POST", body: form }));
}

export const jpegFile = (bytes: Uint8Array, name = "photo.jpg", type = "image/jpeg") =>
  new File([new Uint8Array(bytes)], name, { type });

export async function cardPng(campaign: CampaignView, spotCode: string): Promise<Uint8Array> {
  const spot = campaign.spots.find((candidate) => candidate.code === spotCode);
  if (spot?.card == null) throw new Error(`Spot ${spotCode} has no card`);
  return assetBytes(spot.card.pngUrl);
}

export const phonePhoto = async (
  campaign: CampaignView,
  spotCode: string,
  scene: Partial<Scene> = {},
): Promise<Buffer> =>
  photographCard(await cardPng(campaign, spotCode), {
    ...plainScene,
    rotateDegrees: 12,
    tilt: 0.12,
    jpegQuality: 80,
    ...scene,
  });
