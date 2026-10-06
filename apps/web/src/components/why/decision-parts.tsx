import { HourglassIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { DispatchedActionView, RemediationDecisionView } from "@datum/core";
import { KeyText } from "@/components/status/key-text";
import { formatSgtMoment, formatWireMoney, plural, spotList } from "@/lib/format";
import { OutcomeChip } from "./verdict-block";

type Planner = RemediationDecisionView["planner"];

export function ProposalBlock({ planner }: { planner: Planner }) {
  if (planner.proposal === null) {
    return (
      <p className="text-[15px] text-ink">
        {planner.failure === null
          ? "No recovery model is configured for this worker, so no plan was proposed."
          : "The model did not return a usable plan."}
        {planner.failure !== null && (
          <span className="mt-2 block font-mono text-xs break-words text-muted">
            {planner.failure.code}: {planner.failure.detail}
          </span>
        )}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2.5">
        {planner.proposal.actions.map((action, index) => (
          <li
            key={`${action.spotCodes.join("-")}-${String(index)}`}
            className="rounded-xl border border-line px-4 py-3"
          >
            <p className="text-[15px] text-ink">
              Trip {index + 1}: {spotList(action.spotCodes)}, due within{" "}
              <span className="font-mono tabular-nums">
                {plural(action.dueInMinutes, "minute")}
              </span>
            </p>
            {action.runnerNote.length > 0 && (
              <p className="mt-1 text-sm text-muted">Note for the runner: {action.runnerNote}</p>
            )}
          </li>
        ))}
      </ol>
      <blockquote className="border-l-2 border-line-strong pl-4 text-sm text-muted">
        {planner.proposal.rationale}
      </blockquote>
      {planner.verdict !== null && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
          Rules on this proposal <OutcomeChip outcome={planner.verdict.outcome} />
          {planner.verdict.reason !== null && (
            <span className="font-mono">{planner.verdict.reason}</span>
          )}
        </p>
      )}
    </div>
  );
}

function ActionCard({ action }: { action: DispatchedActionView }) {
  return (
    <li className="rounded-xl border border-line p-4">
      <p className="text-xs text-muted">Idempotency key</p>
      <p className="mt-1 font-mono text-[13px] text-accent">
        <KeyText value={action.idempotencyKey} />
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {action.tasks.map((task) => (
          <li key={task.idempotencyKey} className="text-sm text-ink">
            Spot {task.spotCode} · attempt {task.attempt}
            <span className="block font-mono text-xs text-muted">
              <KeyText value={task.idempotencyKey} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 font-mono text-xs text-muted tabular-nums">
        {formatWireMoney(action.estimatedCost)} · due {formatSgtMoment(action.dueBy)} SGT
      </p>
      {action.runnerNote !== null && action.runnerNote.length > 0 && (
        <p className="mt-2 text-sm text-muted">Runner note: {action.runnerNote}</p>
      )}
    </li>
  );
}

export function DispatchBlock({ decision }: { decision: RemediationDecisionView }) {
  if (decision.actions.length === 0) {
    return (
      <p className="text-[15px] text-ink">
        {decision.verdict.outcome === "NEEDS_APPROVAL"
          ? "Nothing was dispatched. Datum is waiting for your decision on the budget."
          : "Nothing was dispatched."}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {decision.appliedAt === null ? (
        <p className="flex gap-2 text-sm text-warn">
          <HugeiconsIcon
            icon={HourglassIcon}
            size={16}
            strokeWidth={1.8}
            className="mt-0.5 shrink-0"
            aria-hidden
          />
          Decided and saved, not dispatched yet. The worker sends it under these keys, so a restart
          cannot send it twice.
        </p>
      ) : (
        <p className="text-sm text-muted">
          Dispatched by the Goal Loop at {formatSgtMoment(decision.appliedAt)} SGT.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {decision.actions.map((action) => (
          <ActionCard key={action.idempotencyKey} action={action} />
        ))}
      </ul>
    </div>
  );
}
