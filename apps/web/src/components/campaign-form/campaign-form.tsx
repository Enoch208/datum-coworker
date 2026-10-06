import { useRef, useState } from "react";
import { BrandSection } from "./brand-section";
import { BriefPanel, type SubmitPhase } from "./brief-panel";
import {
  emptyCampaignForm,
  hasErrors,
  validateCampaignForm,
  type CampaignFormErrors,
  type CampaignFormValues,
  type TextField,
} from "./form-values";
import { MessageSection } from "./message-section";
import { ScheduleSection } from "./schedule-section";
import { SpotList } from "./spot-list";

const fieldIds: Record<TextField, string> = {
  brandName: "brand-name",
  brandUrl: "brand-url",
  message: "message",
  destinationUrl: "destination-url",
  deadlineDate: "deadline-date",
  deadlineTime: "deadline-time",
  budget: "budget",
};

const fieldOrder: readonly TextField[] = ["brandName", "brandUrl", "message", "destinationUrl"];
const lateFields: readonly TextField[] = ["deadlineDate", "budget"];

function firstInvalidId(values: CampaignFormValues, errors: CampaignFormErrors): string | null {
  const early = fieldOrder.find((field) => errors.fields[field] !== undefined);
  if (early !== undefined) return fieldIds[early];
  const spotIndex = errors.spots.findIndex((spot) => spot.name ?? spot.instructions);
  const spot = values.spots[spotIndex];
  if (spot !== undefined) {
    const part = errors.spots[spotIndex]?.name === undefined ? "place" : "name";
    return `spot-${String(spot.key)}-${part}`;
  }
  const late = lateFields.find((field) => errors.fields[field] !== undefined);
  return late === undefined ? null : fieldIds[late];
}

const noErrors: CampaignFormErrors = { fields: {}, spots: [] };

export function CampaignForm({
  phase,
  serverError,
  onSubmit,
}: {
  phase: SubmitPhase;
  serverError: Error | null;
  onSubmit: (values: CampaignFormValues) => void;
}) {
  const [values, setValues] = useState<CampaignFormValues>(emptyCampaignForm);
  const [errors, setErrors] = useState<CampaignFormErrors>(noErrors);
  const [checked, setChecked] = useState(false);
  const keys = useRef(1);

  const update = (next: CampaignFormValues) => {
    setValues(next);
    if (checked) setErrors(validateCampaignForm(next, Date.now()));
  };
  const onText = (field: TextField, value: string) => {
    update({ ...values, [field]: value });
  };
  const sectionProps = { values, errors, onText };

  return (
    <form
      noValidate
      className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16"
      onSubmit={(event) => {
        event.preventDefault();
        const found = validateCampaignForm(values, Date.now());
        setErrors(found);
        setChecked(true);
        if (!hasErrors(found)) {
          onSubmit(values);
          return;
        }
        const target = firstInvalidId(values, found);
        if (target !== null) document.getElementById(target)?.focus();
      }}
    >
      <fieldset disabled={phase !== "idle"} className="min-w-0">
        <legend className="sr-only">Campaign brief</legend>
        <BrandSection {...sectionProps} />
        <MessageSection {...sectionProps} />
        <SpotList
          spots={values.spots}
          errors={errors.spots}
          onSpots={(spots) => {
            update({ ...values, spots });
          }}
          newKey={() => keys.current++}
        />
        <ScheduleSection {...sectionProps} />
      </fieldset>
      <BriefPanel values={values} phase={phase} serverError={serverError} />
    </form>
  );
}
