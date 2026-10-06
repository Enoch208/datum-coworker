import { Alert02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { cx } from "@/lib/cx";

function NoteList({
  title,
  items,
  icon,
  tone,
}: {
  title: string;
  items: readonly string[];
  icon: IconSvgElement;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-line p-5">
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">None.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {items.map((item, index) => (
            <li key={`${String(index)}-${item}`} className="flex gap-2.5 text-sm text-muted">
              <HugeiconsIcon
                icon={icon}
                size={16}
                strokeWidth={1.8}
                className={cx("mt-0.5 shrink-0", tone)}
                aria-hidden
              />
              <span className="break-words">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NotesPanel({
  assumptions,
  warnings,
}: {
  assumptions: readonly string[];
  warnings: readonly string[];
}) {
  return (
    <section aria-label="Assumptions and warnings" className="grid gap-4 sm:grid-cols-2">
      <NoteList title="Warnings for you" items={warnings} icon={Alert02Icon} tone="text-warn" />
      <NoteList
        title="Assumptions in this plan"
        items={assumptions}
        icon={InformationCircleIcon}
        tone="text-muted"
      />
    </section>
  );
}
