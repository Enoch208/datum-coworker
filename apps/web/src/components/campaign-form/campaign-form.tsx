import { useRef, useState } from "react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { primaryButton, quietButton } from "@/components/feedback/buttons";
import { BrandSection } from "./brand-section";
import { BriefPanel, type SubmitPhase } from "./brief-panel";
import {
  emptyCampaignForm,
  validateCampaignForm,
  type CampaignFormErrors,
  type CampaignFormValues,
  type TextField,
} from "./form-values";
import { firstInvalidStep, firstStepError, type BriefStep } from "./form-steps";
import { MessageSection } from "./message-section";
import { ScheduleSection } from "./schedule-section";
import { SpotList } from "./spot-list";
import { StepNavigation } from "./step-navigation";

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
  const [step, setStep] = useState<BriefStep>(0);
  const keys = useRef(1);
  const busy = phase !== "idle";
  const update = (next: CampaignFormValues) => {
    setValues(next);
    if (checked) setErrors(validateCampaignForm(next, Date.now()));
  };
  const onText = (field: TextField, value: string) => {
    update({ ...values, [field]: value });
  };
  const sectionProps = { values, errors, onText };
  const moveTo = (next: BriefStep, focusId = "brief-step-content") => {
    setStep(next);
    if (focusId === "brief-step-content") {
      setChecked(false);
      setErrors(noErrors);
    }
    window.requestAnimationFrame(() => {
      const target = document.getElementById(focusId);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({
        block: focusId === "brief-step-content" ? "start" : "center",
        behavior: "instant",
      });
    });
  };
  const submit = () => {
    if (busy) return;
    const found = validateCampaignForm(values, Date.now());
    setErrors(found);
    setChecked(true);
    if (step < 2) {
      const target = firstStepError(step, values, found);
      if (target !== null) {
        document.getElementById(target)?.focus();
        return;
      }
      moveTo(step === 0 ? 1 : 2);
      return;
    }
    const invalid = firstInvalidStep(values, found);
    if (invalid !== null) {
      moveTo(invalid, firstStepError(invalid, values, found) ?? "brief-step-content");
      return;
    }
    onSubmit(values);
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <StepNavigation step={step} busy={busy} onSelect={moveTo} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div
          id="brief-step-content"
          tabIndex={-1}
          className="min-w-0 scroll-mt-6 rounded-3xl border border-line bg-canvas/30 p-5 focus:outline-none sm:p-7"
        >
          <p role="status" className="eyebrow mb-6 text-accent">
            Step {step + 1} of 3
          </p>
          <fieldset disabled={busy} className="min-w-0">
            <legend className="sr-only">Campaign brief</legend>
            {step === 0 && (
              <>
                <BrandSection {...sectionProps} />
                <MessageSection {...sectionProps} />
              </>
            )}
            {step === 1 && (
              <SpotList
                spots={values.spots}
                errors={errors.spots}
                onSpots={(spots) => {
                  update({ ...values, spots });
                }}
                newKey={() => keys.current++}
              />
            )}
            {step === 2 && <ScheduleSection {...sectionProps} />}
          </fieldset>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            {step > 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  moveTo(step === 2 ? 1 : 0);
                }}
                className={quietButton}
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} size={16} aria-hidden />
                Back
              </button>
            ) : (
              <span className="text-xs text-muted">You’ll approve the plan later.</span>
            )}
            {step < 2 && (
              <button type="submit" className={primaryButton}>
                Continue <HugeiconsIcon icon={ArrowRight01Icon} size={16} aria-hidden />
              </button>
            )}
          </div>
        </div>
        <BriefPanel values={values} phase={phase} serverError={serverError} ready={step === 2} />
      </div>
    </form>
  );
}
