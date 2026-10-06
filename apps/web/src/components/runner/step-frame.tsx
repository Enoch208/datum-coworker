import type { ReactNode, Ref } from "react";

export function StepFrame({
  title,
  children,
  ref,
}: {
  title: string;
  children: ReactNode;
  ref?: Ref<HTMLElement>;
}) {
  return (
    <section
      ref={ref}
      className="mt-8 scroll-mt-4 flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4"
    >
      <h2 className="text-xl font-medium tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function StepText({ children }: { children: ReactNode }) {
  return <p className="text-[17px] leading-snug text-muted">{children}</p>;
}
