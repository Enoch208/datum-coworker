import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { briefSteps, type BriefStep } from "./form-steps";

export function StepNavigation({
  step,
  busy,
  onSelect,
}: {
  step: BriefStep;
  busy: boolean;
  onSelect: (step: BriefStep) => void;
}) {
  return (
    <nav
      aria-label="Campaign brief steps"
      className="mb-6 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-canvas/50 p-2"
    >
      {briefSteps.map((label, index) => (
        <button
          key={label}
          type="button"
          disabled={busy || index > step}
          onClick={() => {
            onSelect(index as BriefStep);
          }}
          aria-current={index === step ? "step" : undefined}
          className={`flex min-h-16 flex-col items-center justify-center gap-2 rounded-xl px-1 py-2 text-[11px] transition-colors sm:min-h-14 sm:flex-row sm:justify-start sm:px-4 sm:text-sm ${index === step ? "bg-raised text-ink" : "text-faint disabled:cursor-default"}`}
        >
          {index < step ? (
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              size={17}
              className="shrink-0 text-accent"
              aria-hidden
            />
          ) : (
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] ${index === step ? "border-accent/40 text-accent" : "border-line text-faint"}`}
            >
              {index + 1}
            </span>
          )}
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
