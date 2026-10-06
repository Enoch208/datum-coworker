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
    <section aria-labelledby={headingId} className="pb-6 last:pb-0">
      <div className="mb-6 flex gap-4">
        <div>
          <h2 id={headingId} className="text-xl font-normal tracking-tight text-ink">
            {title}
          </h2>
          <p className="mt-1.5 text-[15px] text-pretty text-muted">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}
