import { ArrowUpRight01Icon, HourglassIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { MasumiProofView } from "@datum/core";
import type { ReactNode } from "react";
import { formatSgtMoment, shortHash } from "@/lib/format";
import { atomicToToken, explorerTx } from "./outcome-words";
import { ReceiptSection } from "./receipt-section";

const tusdmDecimals = 6;

function Check({ verified, children }: { verified: boolean; children?: ReactNode }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className={
          verified
            ? "inline-flex items-center gap-1 font-medium text-ok"
            : "inline-flex items-center gap-1 text-muted"
        }
      >
        <HugeiconsIcon
          icon={verified ? Tick02Icon : HourglassIcon}
          size={15}
          strokeWidth={2}
          aria-hidden
        />
        {verified ? "Verified" : "Not verified yet"}
      </span>
      {children}
    </span>
  );
}

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

function Rows({ proof }: { proof: MasumiProofView }) {
  const verified = proof.collectionConfirmed;
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
    { label: "Funds locked", value: <Check verified={verified} /> },
    {
      label: "Result submitted",
      value: (
        <Check verified={verified}>
          <span className="font-mono text-[13px] text-muted" title={proof.resultHash}>
            {shortHash(proof.resultHash)}
          </span>
        </Check>
      ),
    },
    { label: "Result matches", value: <Check verified={verified} /> },
    {
      label: "Seller collection",
      value: (
        <Check verified={verified}>
          {proof.collectionTxHash !== null && <TxLink hash={proof.collectionTxHash} />}
        </Check>
      ),
    },
    {
      label: "Earned",
      value:
        verified && proof.netReceivedAtomic !== null ? (
          <span className="font-mono text-lg text-accent tabular-nums">
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
        </>
      )}
    </ReceiptSection>
  );
}
