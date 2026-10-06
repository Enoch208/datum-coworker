import type { GoalRequirementView, GoalStateView } from "@datum/core";
import { KeyText } from "@/components/status/key-text";
import { SpotStatusChip } from "@/components/status/spot-status-chip";
import { formatSgtMoment } from "@/lib/format";
import { reasonCodeLabels } from "@/lib/goal-schemas";

const reasonText = (requirement: GoalRequirementView): string => {
  if (requirement.reason !== null) return requirement.reason;
  if (requirement.passedAt !== null) {
    return `verified by a photo at ${formatSgtMoment(requirement.passedAt)} SGT`;
  }
  return "—";
};

function Key({ value }: { value: string | null }) {
  if (value === null) return <span className="text-faint">none open</span>;
  return (
    <span className="font-mono text-[12px] text-ink">
      <KeyText value={value} />
    </span>
  );
}

function ReasonCode({ requirement }: { requirement: GoalRequirementView }) {
  if (requirement.reasonCode === null) return null;
  return (
    <span className="mt-1 block font-mono text-[11px] text-muted">
      {requirement.reasonCode} · {reasonCodeLabels[requirement.reasonCode]}
    </span>
  );
}

function Stacked({ requirements }: { requirements: readonly GoalRequirementView[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line md:hidden">
      {requirements.map((requirement) => (
        <li key={requirement.spotCode} className="flex flex-col gap-3 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="font-mono text-base text-ink">{requirement.spotCode}</span>
              <span className="truncate text-sm text-muted">{requirement.name}</span>
            </span>
            <SpotStatusChip status={requirement.status} />
          </div>
          <p className="text-sm text-ink">
            {reasonText(requirement)}
            <ReasonCode requirement={requirement} />
          </p>
          <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-muted">Attempts</dt>
            <dd className="font-mono text-ink tabular-nums">{requirement.attempts}</dd>
            <dt className="text-muted">Open task key</dt>
            <dd>
              <Key value={requirement.openTaskKey} />
            </dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}

const headClass = "py-2.5 pr-4 text-left text-xs font-normal text-muted";

function Wide({ requirements }: { requirements: readonly GoalRequirementView[] }) {
  return (
    <table className="hidden w-full border-collapse md:table">
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className={headClass}>
            Spot
          </th>
          <th scope="col" className={headClass}>
            Status
          </th>
          <th scope="col" className={headClass}>
            Reason
          </th>
          <th scope="col" className={`${headClass} text-right`}>
            Attempts
          </th>
          <th scope="col" className={`${headClass} pr-0`}>
            Open task key
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {requirements.map((requirement) => (
          <tr key={requirement.spotCode} className="align-top">
            <th scope="row" className="py-3.5 pr-4 text-left font-normal">
              <span className="font-mono text-base text-ink">{requirement.spotCode}</span>
              <span className="mt-0.5 block max-w-[10rem] text-xs text-muted">
                {requirement.name}
              </span>
            </th>
            <td className="py-3.5 pr-4">
              <SpotStatusChip status={requirement.status} />
            </td>
            <td className="py-3.5 pr-4 text-sm text-ink">
              {reasonText(requirement)}
              <ReasonCode requirement={requirement} />
            </td>
            <td className="py-3.5 pr-4 text-right font-mono text-sm text-ink tabular-nums">
              {requirement.attempts}
            </td>
            <td className="w-[15rem] py-3.5 text-xs">
              <Key value={requirement.openTaskKey} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RequirementsTable({ goal }: { goal: GoalStateView }) {
  return (
    <>
      <p className="mb-4 text-[15px] text-muted">
        One measurable requirement per approved spot.{" "}
        <span className="font-mono text-ink tabular-nums">
          {goal.passed} / {goal.required}
        </span>{" "}
        met, evaluated {formatSgtMoment(goal.evaluatedAt)} SGT.
      </p>
      <Stacked requirements={goal.requirements} />
      <Wide requirements={goal.requirements} />
    </>
  );
}
