import { AlertCircleIcon, Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { formatMoney, isMoneyText, parseMoney } from "@datum/core";
import type { ReactNode } from "react";
import { primaryButton } from "@/components/feedback/buttons";
import { formatSgt } from "@/lib/format";
import { deadlineInstant, type CampaignFormValues } from "./form-values";

export type SubmitPhase = "idle" | "creating" | "planning";

const phaseText: Record<Exclude<SubmitPhase, "idle">, string> = {
  creating: "Saving the campaign…",
  planning: "Drafting the campaign and rendering one card per spot…",
};

function Slot({ value, empty }: { value: string | null; empty: string }) {
  return value === null ? (
    <span className="text-muted underline decoration-line-strong decoration-dashed underline-offset-4">
      {empty}
    </span>
  ) : (
    <span className="text-ink">{value}</span>
  );
}

function briefParts(values: CampaignFormValues) {
  const deadline =
    values.deadlineDate !== "" && values.deadlineTime !== ""
      ? deadlineInstant(values.deadlineDate, values.deadlineTime)
      : null;
  const budget = values.budget.trim();
  const count = values.spots.length;
  return {
    brand: values.brandName.trim() || null,
    spots: `${String(count)} approved ${count === 1 ? "spot" : "spots"}`,
    deadline: deadline !== null && !Number.isNaN(Date.parse(deadline)) ? formatSgt(deadline) : null,
    budget: isMoneyText(budget) ? formatMoney(parseMoney(budget, "SGD")) : null,
  };
}

function Step({ n, children }: { n: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="font-mono text-xs text-muted tabular-nums">{n}</span>
      <span>{children}</span>
    </li>
  );
}

export function BriefPanel({
  values,
  phase,
  serverError,
  ready,
}: {
  values: CampaignFormValues;
  phase: SubmitPhase;
  serverError: Error | null;
  ready: boolean;
}) {
  const parts = briefParts(values);
  const busy = phase !== "idle";
  return (
    <aside className="rounded-2xl border border-line bg-raised/40 p-6 xl:sticky xl:top-8">
      <h2 className="eyebrow text-muted">Your brief</h2>
      <p className="mt-4 text-lg leading-snug font-light tracking-tight">
        Get a campaign for <Slot value={parts.brand} empty="your brand" /> live at{" "}
        <span className="text-ink">{parts.spots}</span> by{" "}
        <Slot value={parts.deadline} empty="the deadline" />, spending no more than{" "}
        <Slot value={parts.budget} empty="your budget" />.
      </p>
      <h3 className="mt-8 text-sm font-medium text-ink">What happens next</h3>
      <ol className="mt-3 flex flex-col gap-2.5 text-sm text-muted">
        <Step n="1">Datum drafts the copy and plan, and renders a card per spot.</Step>
        <Step n="2">You review the proposal and approve it once.</Step>
        <Step n="3">Nothing is printed, placed or spent before that approval.</Step>
      </ol>
      {serverError !== null && (
        <div
          role="alert"
          className="mt-6 flex gap-3 rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm"
        >
          <HugeiconsIcon
            icon={AlertCircleIcon}
            size={18}
            strokeWidth={1.8}
            className="mt-0.5 shrink-0 text-danger"
            aria-hidden
          />
          <div>
            <p className="font-medium text-ink">The campaign was not created</p>
            <p className="mt-1 whitespace-pre-line text-muted">{serverError.message}</p>
          </div>
        </div>
      )}
      {ready && (
        <button type="submit" disabled={busy} className={`${primaryButton} mt-6 w-full`}>
          {busy && (
            <HugeiconsIcon
              icon={Loading03Icon}
              size={18}
              strokeWidth={2}
              className="animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          )}
          {busy ? "Preparing your plan…" : "Create my plan"}
        </button>
      )}
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-muted">
        {phase === "idle"
          ? ready
            ? "Review and approve before any work starts."
            : "Your brief updates as you go."
          : phaseText[phase]}
      </p>
    </aside>
  );
}
