import { isMoneyText, parseMoney, toWireMoney, type CreateCampaignRequest } from "@datum/core";

export const messageLimit = 280;
export const spotLimit = 26;

export interface SpotRow {
  readonly key: number;
  readonly name: string;
  readonly instructions: string;
}

export interface CampaignFormValues {
  readonly brandName: string;
  readonly brandUrl: string;
  readonly message: string;
  readonly destinationUrl: string;
  readonly spots: readonly SpotRow[];
  readonly deadlineDate: string;
  readonly deadlineTime: string;
  readonly budget: string;
}

export type TextField = Exclude<keyof CampaignFormValues, "spots">;

export interface SpotErrors {
  readonly name?: string;
  readonly instructions?: string;
}

export interface CampaignFormErrors {
  readonly fields: Partial<Record<TextField, string>>;
  readonly spots: readonly SpotErrors[];
}

export const spotCodeAt = (index: number): string => String.fromCharCode(65 + index);

export const emptySpot = (key: number): SpotRow => ({ key, name: "", instructions: "" });

export const emptyCampaignForm: CampaignFormValues = {
  brandName: "",
  brandUrl: "",
  message: "",
  destinationUrl: "",
  spots: [emptySpot(0)],
  deadlineDate: "",
  deadlineTime: "",
  budget: "",
};

export const withScheme = (url: string): string => {
  const trimmed = url.trim();
  if (trimmed.length === 0 || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const isWebAddress = (value: string): boolean =>
  URL.canParse(value) && ["http:", "https:"].includes(new URL(value).protocol);

export const deadlineInstant = (date: string, time: string): string => `${date}T${time}:00+08:00`;

const textError = (value: string, max: number, missing: string, tooLong: string) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return missing;
  return trimmed.length > max ? tooLong : undefined;
};

const urlError = (value: string, optional: boolean): string | undefined => {
  const trimmed = withScheme(value);
  if (trimmed.length === 0) {
    return optional ? undefined : "Enter where the QR code should send people.";
  }
  return isWebAddress(trimmed) ? undefined : "Enter a full web address, like https://example.com.";
};

const deadlineError = (values: CampaignFormValues, now: number): string | undefined => {
  if (values.deadlineDate === "" || values.deadlineTime === "") {
    return "Pick the date and time every spot must be live by.";
  }
  const at = Date.parse(deadlineInstant(values.deadlineDate, values.deadlineTime));
  if (Number.isNaN(at)) return "Pick a real date and time.";
  return at > now ? undefined : "That time has already passed in Singapore. Pick a later one.";
};

const budgetError = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!isMoneyText(trimmed)) return "Enter an amount in SGD, like 50 or 50.00.";
  return parseMoney(trimmed, "SGD").amountMinor > 0 ? undefined : "The budget must be above zero.";
};

const spotErrors = (spot: SpotRow, code: string): SpotErrors => {
  const name = textError(
    spot.name,
    120,
    `Name spot ${code}.`,
    "Keep the name under 120 characters.",
  );
  const instructions = textError(
    spot.instructions,
    1000,
    `Tell the runner exactly where spot ${code} goes.`,
    "Keep the instructions under 1,000 characters.",
  );
  return { ...(name ? { name } : {}), ...(instructions ? { instructions } : {}) };
};

export function validateCampaignForm(values: CampaignFormValues, now: number): CampaignFormErrors {
  const candidates: Record<TextField, string | undefined> = {
    brandName: textError(
      values.brandName,
      120,
      "Enter the brand name.",
      "Keep it under 120 characters.",
    ),
    brandUrl: urlError(values.brandUrl, true),
    message: textError(
      values.message,
      messageLimit,
      "Write the one line people should read.",
      `Keep it to ${String(messageLimit)} characters.`,
    ),
    destinationUrl: urlError(values.destinationUrl, false),
    deadlineDate: deadlineError(values, now),
    deadlineTime: undefined,
    budget: budgetError(values.budget),
  };
  const fields = Object.fromEntries(
    Object.entries(candidates).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  return { fields, spots: values.spots.map((spot, index) => spotErrors(spot, spotCodeAt(index))) };
}

export const hasErrors = (errors: CampaignFormErrors): boolean =>
  Object.keys(errors.fields).length > 0 ||
  errors.spots.some((spot) => spot.name !== undefined || spot.instructions !== undefined);

export function toCreateRequest(values: CampaignFormValues): CreateCampaignRequest {
  const brandUrl = withScheme(values.brandUrl);
  return {
    brandName: values.brandName.trim(),
    brandUrl: brandUrl.length > 0 ? brandUrl : null,
    message: values.message.trim(),
    destinationUrl: withScheme(values.destinationUrl),
    spots: values.spots.map((spot, index) => ({
      code: spotCodeAt(index),
      name: spot.name.trim(),
      instructions: spot.instructions.trim(),
    })),
    deadline: deadlineInstant(values.deadlineDate, values.deadlineTime),
    budget: toWireMoney(parseMoney(values.budget.trim(), "SGD")),
  };
}
