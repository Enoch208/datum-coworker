import { AlertCircleIcon, Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { secondaryButton } from "./buttons";

export function ErrorPanel({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-4 rounded-xl border border-danger/40 bg-danger/5 p-4 sm:flex-row sm:items-start sm:p-5"
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <HugeiconsIcon
          icon={AlertCircleIcon}
          size={20}
          strokeWidth={1.8}
          className="mt-0.5 shrink-0 text-danger"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="font-medium text-ink">{title}</p>
          <p className="mt-1 text-sm break-words whitespace-pre-line text-muted">{message}</p>
        </div>
      </div>
      {onRetry !== undefined && (
        <button type="button" onClick={onRetry} className={`${secondaryButton} self-start`}>
          <HugeiconsIcon icon={Refresh01Icon} size={16} strokeWidth={1.8} aria-hidden />
          Try again
        </button>
      )}
    </div>
  );
}
