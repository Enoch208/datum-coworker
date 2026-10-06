import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export const controlClass =
  "w-full rounded-xl border bg-canvas/70 px-3.5 text-base text-ink placeholder:text-faint transition-colors hover:border-faint focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none disabled:opacity-60";

export const controlBorder = (error: string | undefined): string =>
  error === undefined ? "border-line-strong" : "border-danger";

export const describedBy = (id: string, error: string | undefined, hint: boolean) =>
  cx(error !== undefined && `${id}-error`, hint && `${id}-hint`) || undefined;

export function FieldError({ id, error }: { id: string; error: string | undefined }) {
  if (error === undefined) return null;
  return (
    <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-danger">
      <HugeiconsIcon
        icon={AlertCircleIcon}
        size={16}
        strokeWidth={1.8}
        className="mt-0.5 shrink-0"
        aria-hidden
      />
      {error}
    </p>
  );
}

export function Field({
  id,
  label,
  optional,
  hint,
  error,
  aside,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error: string | undefined;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {optional && <span className="ml-2 font-normal text-muted">Optional</span>}
        </label>
        {aside}
      </div>
      {children}
      {hint !== undefined && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      <FieldError id={id} error={error} />
    </div>
  );
}
