import { singaporeZone } from "@/lib/format";
import { FieldError, controlBorder, controlClass, describedBy } from "./field";
import { FormSection } from "./form-section";
import type { SectionProps } from "./section-props";

const isoDateInSingapore = new Intl.DateTimeFormat("en-CA", {
  timeZone: singaporeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function DeadlineFields({ values, errors, onText }: SectionProps) {
  const error = errors.fields.deadlineDate;
  const described = describedBy("deadline", error, true);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-ink">Deadline</legend>
      <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_9rem_auto]">
        <label className="col-span-2 sm:col-span-1">
          <span className="sr-only">Date</span>
          <input
            id="deadline-date"
            type="date"
            min={isoDateInSingapore.format(new Date())}
            value={values.deadlineDate}
            onChange={(event) => {
              onText("deadlineDate", event.target.value);
            }}
            aria-invalid={error !== undefined}
            aria-describedby={described}
            className={`${controlClass} ${controlBorder(error)} h-11 font-mono text-sm tabular-nums`}
          />
        </label>
        <label>
          <span className="sr-only">Time</span>
          <input
            id="deadline-time"
            type="time"
            value={values.deadlineTime}
            onChange={(event) => {
              onText("deadlineTime", event.target.value);
            }}
            aria-invalid={error !== undefined}
            aria-describedby={described}
            className={`${controlClass} ${controlBorder(error)} h-11 font-mono text-sm tabular-nums`}
          />
        </label>
        <span className="flex h-11 items-center rounded-[10px] border border-line px-3 font-mono text-xs text-ink">
          SGT
        </span>
      </div>
      <p id="deadline-hint" className="text-sm text-muted">
        Singapore time (UTC+08:00). Every spot must be live by then.
      </p>
      <FieldError id="deadline" error={error} />
    </fieldset>
  );
}

function BudgetField({ values, errors, onText }: SectionProps) {
  const error = errors.fields.budget;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="budget" className="text-sm font-medium text-ink">
        Physical budget
      </label>
      <div className="relative sm:max-w-xs">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-mono text-sm text-muted">
          SGD
        </span>
        <input
          id="budget"
          name="budget"
          inputMode="decimal"
          autoComplete="transaction-amount"
          placeholder="0.00"
          value={values.budget}
          onChange={(event) => {
            onText("budget", event.target.value);
          }}
          aria-invalid={error !== undefined}
          aria-describedby={describedBy("budget", error, true)}
          className={`${controlClass} ${controlBorder(error)} h-11 pl-14 font-mono tabular-nums`}
        />
      </div>
      <p id="budget-hint" className="text-sm text-muted">
        The most Datum may spend on printing and placement. It stops and asks before going over.
      </p>
      <FieldError id="budget" error={error} />
    </div>
  );
}

export function ScheduleSection(props: SectionProps) {
  return (
    <FormSection
      index="04"
      title="When, and how much?"
      description="Choose a deadline and the most you want to spend. These become hard limits after approval."
    >
      <DeadlineFields {...props} />
      <BudgetField {...props} />
    </FormSection>
  );
}
