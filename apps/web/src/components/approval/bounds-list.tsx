import type { ReactNode } from "react";

export interface BoundsRow {
  readonly label: string;
  readonly value: ReactNode;
}

export function BoundsList({ rows }: { rows: readonly BoundsRow[] }) {
  return (
    <dl className="divide-y divide-line border-y border-line">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-3">
          <dt className="text-xs leading-5 text-muted">{row.label}</dt>
          <dd className="min-w-0 text-sm break-words text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SpotCodes({ codes }: { codes: readonly string[] }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {codes.map((code) => (
        <span
          key={code}
          className="flex size-6 items-center justify-center rounded-md border border-line-strong font-mono text-xs"
        >
          {code}
        </span>
      ))}
      <span className="ml-1 text-xs text-muted">
        {codes.length} {codes.length === 1 ? "spot" : "spots"}
      </span>
    </span>
  );
}

export function Mono({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className="font-mono text-[13px] tabular-nums" title={title}>
      {children}
    </span>
  );
}
