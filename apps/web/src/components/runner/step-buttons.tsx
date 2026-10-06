import { Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import type { ChangeEvent } from "react";
import { touchPrimary, touchSecondary } from "@/components/feedback/buttons";

export function Spinner() {
  return (
    <HugeiconsIcon
      icon={Loading03Icon}
      size={20}
      strokeWidth={2}
      className="animate-spin motion-reduce:animate-none"
      aria-hidden
    />
  );
}

export function PhotoButton({
  id,
  label,
  icon,
  primary,
  disabled,
  onChosen,
}: {
  id: string;
  label: string;
  icon: IconSvgElement;
  primary: boolean;
  disabled?: boolean;
  onChosen: (file: File) => void;
}) {
  const changed = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file !== undefined) onChosen(file);
  };
  return (
    <div>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        disabled={disabled}
        onChange={changed}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className={`${primary ? touchPrimary : touchSecondary} cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:cursor-not-allowed peer-disabled:opacity-50`}
      >
        <HugeiconsIcon icon={icon} size={20} strokeWidth={1.8} aria-hidden />
        {label}
      </label>
    </div>
  );
}

export function SendProgress({ fraction, what }: { fraction: number; what: string }) {
  const percent = Math.round(fraction * 100);
  const sent = percent >= 100;
  return (
    <div role="status" className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-[15px] text-ink">
        <Spinner />
        {sent
          ? `Datum is checking the ${what}…`
          : `Sending the ${what}…${percent > 0 ? ` ${String(percent)}%` : ""}`}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden>
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${String(percent)}%` }}
        />
      </div>
    </div>
  );
}
