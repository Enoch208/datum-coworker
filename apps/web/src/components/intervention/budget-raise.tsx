import { Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  compareMoney,
  isMoneyText,
  parseMoney,
  raiseBudgetStatementFor,
  type CampaignView,
  type RemediationVerdictView,
  type WireMoney,
} from "@datum/core";
import { useState } from "react";
import { FieldError, controlBorder, controlClass } from "@/components/campaign-form/field";
import { primaryButton } from "@/components/feedback/buttons";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { raiseBudget } from "@/lib/api-client";
import { ownerSigner, signAsOwner } from "@/lib/owner-key";
import { formatWireMoney, toMoney } from "@/lib/format";
import { InterventionNote } from "./intervention-note";

interface Errors {
  readonly amount?: string;
  readonly name?: string;
}

function check(amount: string, name: string, current: WireMoney): Errors {
  const trimmed = amount.trim();
  const amountError = !isMoneyText(trimmed)
    ? "Type an amount such as 29.00."
    : compareMoney(parseMoney(trimmed, current.currency), toMoney(current)) <= 0
      ? `The new cap must be more than ${formatWireMoney(current)}.`
      : undefined;
  const nameError = name.trim().length === 0 ? "Type your name to sign the change." : undefined;
  return {
    ...(amountError === undefined ? {} : { amount: amountError }),
    ...(nameError === undefined ? {} : { name: nameError }),
  };
}

function Figure({ label, money }: { label: string; money: WireMoney | null }) {
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-base whitespace-nowrap text-ink tabular-nums sm:text-lg">
        {money === null ? "—" : formatWireMoney(money)}
      </dd>
    </div>
  );
}

export function BudgetRaise({
  campaign,
  current,
  verdict,
  onDone,
}: {
  campaign: CampaignView;
  current: WireMoney;
  verdict: RemediationVerdictView | null;
  onDone: () => void;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  const amount = typed ?? verdict?.revisedMaximum?.amount ?? "";
  const [name, setName] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const errors = checked ? check(amount, name, current) : {};

  const submit = () => {
    setChecked(true);
    const found = check(amount, name, current);
    if (found.amount !== undefined || found.name !== undefined) return;
    setBusy(true);
    setFailure(null);
    const budget = { amount: amount.trim(), currency: current.currency };
    const approvedBy = name.trim();
    const signed = async () => {
      const { privateKey } = await ownerSigner(campaign);
      const statement = raiseBudgetStatementFor(campaign, budget, approvedBy);
      const signature = await signAsOwner(privateKey, statement);
      await raiseBudget(campaign.id, { budget, approvedBy, signature });
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
      <h3 className="text-xl font-normal tracking-tight text-ink">Raise the budget cap</h3>
      <dl className="grid grid-cols-3 gap-4">
        <Figure label="Approved cap" money={current} />
        <Figure label="Shortfall" money={verdict?.shortfall ?? null} />
        <Figure label="Revised maximum" money={verdict?.revisedMaximum ?? null} />
      </dl>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="new-budget" className="text-sm font-medium text-ink">
            New cap ({current.currency})
          </label>
          <input
            id="new-budget"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) => {
              setTyped(event.target.value);
            }}
            aria-invalid={errors.amount !== undefined}
            className={`${controlClass} ${controlBorder(errors.amount)} h-11 font-mono tabular-nums`}
          />
          <FieldError id="new-budget" error={errors.amount} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="budget-approver" className="text-sm font-medium text-ink">
            Your name
          </label>
          <input
            id="budget-approver"
            autoComplete="name"
            maxLength={120}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            aria-invalid={errors.name !== undefined}
            className={`${controlClass} ${controlBorder(errors.name)} h-11`}
          />
          <FieldError id="budget-approver" error={errors.name} />
        </div>
      </div>
      <InterventionNote />
      {failure !== null && <ErrorPanel title="The cap was not raised" message={failure} />}
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
        {busy ? "Raising…" : "Approve the higher cap"}
      </button>
    </form>
  );
}
