import { ArrowUpRight01Icon, HourglassIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { MasumiProofView } from "@datum/core";
import type { ReactNode } from "react";
import { formatSgtMoment, shortHash } from "@/lib/format";
import { atomicToToken, explorerTx } from "./outcome-words";
import { paymentSteps, stepWord, type PaymentStep } from "./payment-steps";
import { ReceiptSection } from "./receipt-section";

const tusdmDecimals = 6;

function TxLink({ hash }: { hash: string }) {
  return (
    <a
      href={explorerTx(hash)}
      target="_blank"
      rel="noreferrer"
      title={hash}
      className="inline-flex items-center gap-1 font-mono text-[13px] text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
    >
      {shortHash(hash)}
      <HugeiconsIcon icon={ArrowUpRight01Icon} size={13} strokeWidth={1.8} aria-hidden />
    </a>
  );
}

function StepStatus({ step, children }: { step: PaymentStep; children?: ReactNode }) {
  const reached = step.state !== "waiting";
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className={
          reached
            ? "inline-flex items-center gap-1 font-medium text-ok"
            : "inline-flex items-center gap-1 text-muted"
        }
      >
        <HugeiconsIcon
          icon={reached ? Tick02Icon : HourglassIcon}
          size={15}
          strokeWidth={2}
          aria-hidden
        />
        {stepWord(step)}
      </span>
      {step.txHash !== null && <TxLink hash={step.txHash} />}
      {children}
    </span>
  );
}

function Rows({ proof }: { proof: MasumiProofView }) {
  const rows: { label: string; value: ReactNode }[] = [
    { label: "Network", value: "Cardano Preprod" },
    {
      label: "Sokosumi Task",
      value: <span className="font-mono text-[13px] break-all">{proof.sokosumiTaskId}</span>,
    },
    {
      label: "Masumi payment",
      value: (
        <span className="font-mono text-[13px]" title={proof.blockchainIdentifier}>
          {shortHash(proof.blockchainIdentifier)}
        </span>
      ),
    },
    ...paymentSteps(proof).map((step) => ({
      label: step.label,
      value: (
        <StepStatus step={step}>
          {step.key === "result" && (
            <span className="font-mono text-[13px] text-muted" title={proof.resultHash}>
              {shortHash(proof.resultHash)}
            </span>
          )}
        </StepStatus>
      ),
    })),
    {
      label: "Earned",
      value:
        proof.collectionConfirmed && proof.netReceivedAtomic !== null ? (
          <span className="font-mono text-lg font-medium text-ink tabular-nums">
            +{atomicToToken(proof.netReceivedAtomic, tusdmDecimals)} tUSDM
          </span>
        ) : (
          <span className="text-muted">Not verified yet</span>
        ),
    },
  ];
  return (
    <dl className="divide-y divide-line border-y border-line">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 py-3">
          <dt className="text-sm text-muted">{row.label}</dt>
          <dd className="min-w-0 text-sm text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function HowChecked() {
  return (
    <div className="mt-4 text-sm text-pretty text-muted">
      <p>
        Datum does not treat a finished Task as proof of payment. After the payout it reads Cardano
        itself and confirms the money arrived.
      </p>
      <details className="mt-2 print:hidden">
        <summary className="w-fit cursor-pointer text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
          How Datum checks this
        </summary>
        <div className="mt-2 space-y-2">
          <p>
            Confirmed means the payment service reported the transaction on chain. Verified means
            Datum re-read the chain itself.
          </p>
          <p>
            Datum looks up the result transaction and finds the one contract output whose datum
            carries this result&apos;s hash and holds exactly the agreed tUSDM. It then checks that
            the seller collection spent that output, that the contract&apos;s script passed, and
            that the seller&apos;s tUSDM balance rose by at least the payment. Sokosumi&apos;s
            receipt, the payment service and the chain must all name the same collection
            transaction.
          </p>
        </div>
      </details>
    </div>
  );
}

export function CoworkerPayment({ proof }: { proof: MasumiProofView | null }) {
  return (
    <ReceiptSection
      id="receipt-payment-heading"
      title="Coworker payment"
      note="Masumi pays Datum as the Coworker on Cardano. Printing and runner costs are ordinary expenses and are never paid through Masumi."
    >
      {proof === null ? (
        <p className="rounded-xl border border-dashed border-line-strong p-5 text-[15px] text-muted">
          This campaign was not hired through a paid Sokosumi Task.
        </p>
      ) : (
        <>
          <Rows proof={proof} />
          {proof.verifiedAt !== null && (
            <p className="mt-3 font-mono text-xs text-muted">
              Checked on chain {formatSgtMoment(proof.verifiedAt)} SGT
            </p>
          )}
          <HowChecked />
        </>
      )}
    </ReceiptSection>
  );
}
