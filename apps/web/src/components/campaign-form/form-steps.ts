import type { CampaignFormErrors, CampaignFormValues, TextField } from "./form-values";

export const briefSteps = ["Your message", "Your locations", "Your limits"] as const;
export type BriefStep = 0 | 1 | 2;

const fieldsByStep: readonly (readonly TextField[])[] = [
  ["brandName", "brandUrl", "message", "destinationUrl"],
  [],
  ["deadlineDate", "budget"],
];
const fieldIds: Record<TextField, string> = {
  brandName: "brand-name",
  brandUrl: "brand-url",
  message: "message",
  destinationUrl: "destination-url",
  deadlineDate: "deadline-date",
  deadlineTime: "deadline-time",
  budget: "budget",
};

export function firstStepError(
  step: BriefStep,
  values: CampaignFormValues,
  errors: CampaignFormErrors,
): string | null {
  if (step === 1) {
    const index = errors.spots.findIndex(
      (spot) => spot.name !== undefined || spot.instructions !== undefined,
    );
    const spot = values.spots[index];
    if (spot === undefined) return null;
    return `spot-${String(spot.key)}-${errors.spots[index]?.name === undefined ? "place" : "name"}`;
  }
  const field = fieldsByStep[step]?.find((name) => errors.fields[name] !== undefined);
  return field === undefined ? null : fieldIds[field];
}

export function firstInvalidStep(
  values: CampaignFormValues,
  errors: CampaignFormErrors,
): BriefStep | null {
  for (const step of [0, 1, 2] as const)
    if (firstStepError(step, values, errors) !== null) return step;
  return null;
}
