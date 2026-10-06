import type { ReactNode } from "react";

export function SectionHeading({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id={id} className="text-2xl font-light tracking-tight">
        {title}
      </h2>
      {children !== undefined && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}
