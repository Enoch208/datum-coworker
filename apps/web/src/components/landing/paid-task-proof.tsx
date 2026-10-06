import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";

const explorer = (hash: string): string => `https://preprod.cardanoscan.io/transaction/${hash}`;

const firstPaidTask = {
  taskId: "01a1106d-fd53-74ce-bedd-07fbd75d136c",
  escrowTx: "2f04c89076e7803a6e2bcf7783366c5d2beb0d1763265e2e463e7b352574938f",
  resultTx: "1143d3caa49856ef388fbffcdc2673de1c89837b25db662c7d18d19433ec2360",
  resultHash: "586762430e6e389c13271a7d31307114af60ff320227eef2f4ba1dc500e7fb7e",
  completionEvent: "01a11071-a9cc-70f9-aa3a-36713d0ccb84",
  collectionTx: "0ae460f6d36d76c600dd84287a9d3834754c6d9ea1e56ce3939a00c080b587f9",
} as const;

function Tx({ hash }: { hash: string }) {
  return (
    <a
      href={explorer(hash)}
      target="_blank"
      rel="noreferrer"
      title={hash}
      className="inline-flex items-center gap-1 font-mono text-sm text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
    >
      {hash.slice(0, 8)}…
      <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} strokeWidth={1.8} aria-hidden />
    </a>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-sm break-all text-ink">{children}</span>;
}

const steps: { label: string; evidence: ReactNode }[] = [
  { label: "Hired through a Sokosumi Task", evidence: <Mono>{firstPaidTask.taskId}</Mono> },
  { label: "Buyer's payment locked in escrow", evidence: <Tx hash={firstPaidTask.escrowTx} /> },
  {
    label: "Result hash committed on chain",
    evidence: (
      <span className="flex flex-col gap-1">
        <Tx hash={firstPaidTask.resultTx} />
        <span className="font-mono text-xs break-all text-muted">{firstPaidTask.resultHash}</span>
      </span>
    ),
  },
  {
    label: "Task completed with exactly the hashed result",
    evidence: <Mono>{firstPaidTask.completionEvent}</Mono>,
  },
  {
    label: "Seller collected the payment",
    evidence: (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Tx hash={firstPaidTask.collectionTx} />
        <span className="font-mono text-sm font-medium text-ink">+1 tUSDM</span>
      </span>
    ),
  },
];

export function PaidTaskProof() {
  return (
    <section aria-labelledby="paid-heading" className="py-24 sm:py-32">
      <p className="eyebrow text-muted">Cardano Preprod · 6 October 2026</p>
      <h2
        id="paid-heading"
        className="mt-5 text-3xl font-medium tracking-tight text-balance sm:text-5xl"
      >
        A paid coworker. A verifiable record.
      </h2>
      <p className="mt-5 max-w-2xl text-base font-light text-muted">
        Masumi handles hiring and paying Datum; printers and runners are paid as ordinary expenses.
        This is Datum&apos;s first paid Sokosumi Task, step by step, each linked to its record.
      </p>
      <ol className="mt-10 divide-y divide-line rounded-3xl border border-line bg-surface px-5 sm:px-8">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className="grid gap-2 py-5 sm:grid-cols-[2.5rem_minmax(0,21rem)_minmax(0,1fr)] sm:items-baseline sm:gap-6"
          >
            <span className="font-mono text-xs text-muted tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-[15px] text-ink">{step.label}</span>
            <span className="min-w-0">{step.evidence}</span>
          </li>
        ))}
      </ol>
      <p className="mt-6 max-w-2xl text-sm text-muted">
        Datum counts itself paid only when the collection transaction spends this payment&apos;s own
        escrow output and the seller&apos;s net tUSDM gain in that transaction covers the payment,
        not when a Task says completed.
      </p>
    </section>
  );
}
