import {
  formatMoney,
  printKey,
  recoveryKey,
  type EstimatedPlanStep,
  type IsoTimestamp,
  type Money,
  type PhysicalTaskDraft,
  type PrintFormat,
} from "@datum/core";
import type { SpotRow } from "@datum/db";
import { cardAssetKey, cardAssetUrl } from "../cards/store";

export interface CommissionSource {
  readonly campaignId: string;
  readonly assetVersion: number;
  readonly printFormat: PrintFormat;
  readonly steps: readonly EstimatedPlanStep[];
  readonly spots: readonly SpotRow[];
  readonly dueBy: IsoTimestamp;
  readonly appBaseUrl: string;
}

const firstAttempt = 1;

export const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);

export const placementCardUrl = (
  appBaseUrl: string,
  campaignId: string,
  assetVersion: number,
  spotCode: string,
): string => cardAssetUrl(appBaseUrl, cardAssetKey(campaignId, assetVersion, spotCode, "pdf"));

const cardPdf = (source: CommissionSource, spotCode: string): string =>
  placementCardUrl(source.appBaseUrl, source.campaignId, source.assetVersion, spotCode);

const printInstructions = (source: CommissionSource, copies: number, ceiling: Money): string => {
  const codes = source.spots.map((spot) => spot.code);
  const spares = copies - codes.length;
  return [
    `Print ${String(copies)} copies of the approved ${source.printFormat} cards: at least one card for each spot (${codes.join(", ")}).`,
    spares > 0 ? `The other ${String(spares)} are spares in case a card is damaged.` : "",
    "Each card carries its own spot's QR code, so keep every spot's cards apart.",
    `Pay no more than ${formatMoney(ceiling)}, the amount the customer approved for printing. If it costs more, do not pay: stop, because Datum must ask the customer first.`,
    "Keep the receipt, and upload a photo of it with the amount you paid.",
  ]
    .filter((line) => line.length > 0)
    .join(" ");
};

export const placeInstructions = (spot: SpotRow): string =>
  [
    `Place Spot ${spot.code}'s card at ${sentence(spot.name)}`,
    sentence(spot.instructions),
    "Then take one photo of the placed card with its QR code sharp and fully in frame, and upload it.",
  ].join(" ");

const baseDraft = (source: CommissionSource, step: EstimatedPlanStep) => ({
  campaignId: source.campaignId,
  attempt: firstAttempt,
  assetVersion: source.assetVersion,
  estimatedCost: step.estimatedCost,
  dueBy: source.dueBy,
});

const stepDraft = (source: CommissionSource, step: EstimatedPlanStep): PhysicalTaskDraft => {
  if (step.type === "PRINT_AND_COLLECT") {
    return {
      ...baseDraft(source, step),
      spotCode: null,
      type: step.type,
      idempotencyKey: printKey(source.campaignId, firstAttempt),
      copies: step.quantity,
      instructions: printInstructions(source, step.quantity, step.estimatedCost),
      assetUrls: source.spots.map((spot) => cardPdf(source, spot.code)),
    };
  }
  const spot = source.spots.find((candidate) => candidate.code === step.spotCode);
  if (spot === undefined) throw new Error(`The approved plan places unknown spot ${step.spotCode}`);
  return {
    ...baseDraft(source, step),
    spotCode: spot.code,
    type: step.type,
    idempotencyKey: recoveryKey(source.campaignId, spot.code, firstAttempt),
    copies: null,
    instructions: placeInstructions(spot),
    assetUrls: [cardPdf(source, spot.code)],
  };
};

export const commissionDrafts = (source: CommissionSource): PhysicalTaskDraft[] =>
  source.steps.map((step) => stepDraft(source, step));
