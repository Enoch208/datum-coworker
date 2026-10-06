import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { quietButton, secondaryButton } from "@/components/feedback/buttons";
import { Field, controlBorder, controlClass, describedBy } from "./field";
import { FormSection } from "./form-section";
import { emptySpot, spotCodeAt, spotLimit, type SpotErrors, type SpotRow } from "./form-values";

const focusLater = (id: string) => {
  window.requestAnimationFrame(() => {
    document.getElementById(id)?.focus();
  });
};

function SpotEditor({
  spot,
  index,
  errors,
  removable,
  onChange,
  onRemove,
}: {
  spot: SpotRow;
  index: number;
  errors: SpotErrors | undefined;
  removable: boolean;
  onChange: (spot: SpotRow) => void;
  onRemove: () => void;
}) {
  const code = spotCodeAt(index);
  const nameId = `spot-${String(spot.key)}-name`;
  const placeId = `spot-${String(spot.key)}-place`;
  return (
    <li className="rounded-2xl border border-line bg-raised/40 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg border border-line-strong font-mono text-base text-ink">
            {code}
          </span>
          <span className="text-sm text-muted">Spot {code}</span>
        </div>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove spot ${code}`}
            className={quietButton}
          >
            <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.8} aria-hidden />
            <span className="hidden sm:inline">Remove</span>
          </button>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <Field id={nameId} label="Spot name" error={errors?.name}>
          <input
            id={nameId}
            autoComplete="off"
            value={spot.name}
            onChange={(event) => {
              onChange({ ...spot, name: event.target.value });
            }}
            aria-invalid={errors?.name !== undefined}
            aria-describedby={describedBy(nameId, errors?.name, false)}
            className={`${controlClass} ${controlBorder(errors?.name)} h-11`}
          />
        </Field>
        <Field
          id={placeId}
          label="Placement instructions"
          hint="Exactly where the card goes, so the runner can find the spot without asking."
          error={errors?.instructions}
        >
          <textarea
            id={placeId}
            rows={2}
            value={spot.instructions}
            onChange={(event) => {
              onChange({ ...spot, instructions: event.target.value });
            }}
            aria-invalid={errors?.instructions !== undefined}
            aria-describedby={describedBy(placeId, errors?.instructions, true)}
            className={`${controlClass} ${controlBorder(errors?.instructions)} resize-y py-2.5 leading-relaxed`}
          />
        </Field>
      </div>
    </li>
  );
}

export function SpotList({
  spots,
  errors,
  onSpots,
  newKey,
}: {
  spots: readonly SpotRow[];
  errors: readonly SpotErrors[];
  onSpots: (spots: readonly SpotRow[]) => void;
  newKey: () => number;
}) {
  const full = spots.length >= spotLimit;
  const add = () => {
    const spot = emptySpot(newKey());
    onSpots([...spots, spot]);
    focusLater(`spot-${String(spot.key)}-name`);
  };
  const remove = (index: number) => {
    onSpots(spots.filter((_, at) => at !== index));
    focusLater("add-spot");
  };
  return (
    <FormSection
      index="03"
      title="Where should the cards go?"
      description="Add places you have permission to use. Each location gets its own card and QR code."
    >
      <ol className="flex flex-col gap-3">
        {spots.map((spot, index) => (
          <SpotEditor
            key={spot.key}
            spot={spot}
            index={index}
            errors={errors[index]}
            removable={spots.length > 1}
            onChange={(next) => {
              onSpots(spots.map((current, at) => (at === index ? next : current)));
            }}
            onRemove={() => {
              remove(index);
            }}
          />
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <button
          id="add-spot"
          type="button"
          onClick={add}
          disabled={full}
          className={secondaryButton}
        >
          <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.8} aria-hidden />
          {full ? "All 26 codes in use" : `Add spot ${spotCodeAt(spots.length)}`}
        </button>
        <span className="font-mono text-xs text-muted tabular-nums">
          {spots.length} {spots.length === 1 ? "spot" : "spots"}
        </span>
      </div>
    </FormSection>
  );
}
