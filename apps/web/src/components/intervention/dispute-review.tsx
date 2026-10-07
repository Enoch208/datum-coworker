import { Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { acceptExpenseStatementFor, type CampaignView, type ExpenseView } from "@datum/core";
import { useState } from "react";
import { FieldError, controlBorder, controlClass } from "@/components/campaign-form/field";
import { primaryButton } from "@/components/feedback/buttons";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { ExpenseStatusChip } from "@/components/status/expense-status-chip";
import { acceptExpense } from "@/lib/api-client";
import { ownerSigner, signAsOwner } from "@/lib/owner-key";
import { formatWireMoney } from "@/lib/format";
import { InterventionNote } from "./intervention-note";

const reasonLimit = 280;

function ReceiptFacts({ expense }: { expense: ExpenseView }) {
  return (
    <div className="flex gap-4">
      <a href={expense.receiptUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg">
        <img
          src={expense.receiptUrl}
          alt="The disputed receipt photo"
          className="size-24 rounded-lg border border-line bg-raised object-cover"
        />
      </a>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xl text-ink tabular-nums">
            {formatWireMoney(expense.amount)}
          </span>
          <ExpenseStatusChip status={expense.status} />
        </div>
        <p className="mt-1 text-sm text-muted">
          Entered by the runner{expense.merchant === null ? "" : ` · ${expense.merchant}`}
        </p>
        <p className="mt-3 text-xs text-muted">What the receipt reader found</p>
        <p className="mt-1 text-sm break-words text-ink">{expense.explanation}</p>
      </div>
    </div>
  );
}

export function DisputeReview({
  campaign,
  expense,
  onDone,
}: {
  campaign: CampaignView;
  expense: ExpenseView;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const nameError = checked && name.trim() === "" ? "Type your name." : undefined;
  const reasonError =
    checked && reason.trim() === "" ? "Say why this receipt should count." : undefined;
  const nameId = `accept-name-${expense.id}`;
  const reasonId = `accept-reason-${expense.id}`;

  const submit = () => {
    setChecked(true);
    if (name.trim() === "" || reason.trim() === "") return;
    setBusy(true);
    setFailure(null);
    const acceptedBy = name.trim();
    const why = reason.trim();
    const signed = async () => {
      const { privateKey } = await ownerSigner(campaign);
      const statement = acceptExpenseStatementFor(campaign, expense.id, acceptedBy, why);
      const signature = await signAsOwner(privateKey, statement);
      await acceptExpense(campaign.id, expense.id, { acceptedBy, reason: why, signature });
    };
    void signed().then(
      () => {
        setBusy(false);
        onDone();
      },
      (cause: unknown) => {
        setBusy(false);
        setFailure(cause instanceof Error ? cause.message : String(cause));
      },
    );
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <h3 className="text-xl font-normal tracking-tight text-ink">Review a disputed receipt</h3>
      <ReceiptFacts expense={expense} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <label htmlFor={nameId} className="text-sm font-medium text-ink">
            Your name
          </label>
          <input
            id={nameId}
            autoComplete="name"
            maxLength={120}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            aria-invalid={nameError !== undefined}
            className={`${controlClass} ${controlBorder(nameError)} h-11`}
          />
          <FieldError id={nameId} error={nameError} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={reasonId} className="text-sm font-medium text-ink">
            Why it should count
          </label>
          <textarea
            id={reasonId}
            rows={2}
            maxLength={reasonLimit}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
            aria-invalid={reasonError !== undefined}
            className={`${controlClass} ${controlBorder(reasonError)} resize-y py-2.5`}
          />
          <FieldError id={reasonId} error={reasonError} />
        </div>
      </div>
      <InterventionNote />
      {failure !== null && <ErrorPanel title="The receipt was not accepted" message={failure} />}
      <button
        type="submit"
        disabled={busy}
        className={`${primaryButton} w-full sm:w-auto sm:self-start`}
      >
        {busy && (
          <HugeiconsIcon
            icon={Loading03Icon}
            size={18}
            strokeWidth={2}
            className="animate-spin motion-reduce:animate-none"
            aria-hidden
          />
        )}
        {busy ? "Accepting…" : "Accept this receipt"}
      </button>
    </form>
  );
}
