import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { cx } from "@/lib/cx";

export type Tone = "neutral" | "ok" | "warn" | "danger" | "quiet";

const toneClasses: Record<Tone, string> = {
  neutral: "border-line-strong text-ink",
  ok: "border-ok/35 bg-ok/5 text-ok",
  warn: "border-warn/35 bg-warn/5 text-warn",
  danger: "border-danger/35 bg-danger/5 text-danger",
  quiet: "border-line text-muted",
};

export interface ChipSpec {
  readonly tone: Tone;
  readonly icon: IconSvgElement;
  readonly label: string;
}

export function ToneChip({ tone, icon, label }: ChipSpec) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
      )}
    >
      <HugeiconsIcon icon={icon} size={14} strokeWidth={1.8} aria-hidden />
      {label}
    </span>
  );
}
