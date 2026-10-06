import type { ReactNode } from "react";

export function ReceiptSection({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-line bg-surface p-5 break-inside-avoid sm:p-8"
    >
      <h2 id={id} className="text-xl font-normal tracking-tight text-ink">
        {title}
      </h2>
      {note !== undefined && <p className="mt-1.5 text-sm text-pretty text-muted">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
