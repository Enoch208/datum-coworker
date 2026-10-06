import type { ReactNode } from "react";

export function FormSection({
  index,
  title,
  description,
  children,
}: {
  index: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const headingId = `section-${index}`;
  return (
    <section aria-labelledby={headingId} className="border-t border-line pt-8 pb-10">
      <div className="mb-6 flex gap-4">
        <span className="pt-1 font-mono text-xs text-muted tabular-nums">{index}</span>
        <div>
          <h2 id={headingId} className="text-xl font-normal tracking-tight text-ink">
            {title}
          </h2>
          <p className="mt-1.5 text-[15px] font-light text-muted">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-6 sm:pl-8">{children}</div>
    </section>
  );
}
