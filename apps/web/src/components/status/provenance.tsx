import { AiBrain01Icon, CalculatorIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const chipClass =
  "inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-muted";

export function AiProposed({ model }: { model: string }) {
  return (
    <span className={chipClass}>
      <HugeiconsIcon icon={AiBrain01Icon} size={13} strokeWidth={1.8} aria-hidden />
      AI proposed · {model}
    </span>
  );
}

export function ByRules({ label }: { label: string }) {
  return (
    <span className={chipClass}>
      <HugeiconsIcon icon={CalculatorIcon} size={13} strokeWidth={1.8} aria-hidden />
      {label}
    </span>
  );
}
