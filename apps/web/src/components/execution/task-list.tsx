import { PrinterIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ExecutorAdapter, TaskSummaryView } from "@datum/core";
import { SectionHeading } from "@/components/campaign/section-heading";
import { RecoveryChip, TaskStatusChip, attemptLabel } from "@/components/status/task-status-chip";
import { formatSgtShort } from "@/lib/format";
import { inRunOrder } from "@/lib/task-order";

export const adapterLabels: Record<ExecutorAdapter, string> = {
  LOCAL_ENROLLED_RUNNER: "Local enrolled runner",
  RENTAHUMAN: "RentAHuman",
};

export const taskSummaryTitle = (task: TaskSummaryView): string =>
  task.type === "PRINT_AND_COLLECT"
    ? "Print and collect the cards"
    : `Place the card at Spot ${task.spotCode ?? "?"}`;

function TaskRow({ task }: { task: TaskSummaryView }) {
  return (
    <li className="flex gap-3 py-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line-strong font-mono text-base">
        {task.spotCode ?? (
          <HugeiconsIcon icon={PrinterIcon} size={18} strokeWidth={1.6} aria-label="Print" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-[15px] break-words text-ink">{taskSummaryTitle(task)}</p>
          <div className="flex flex-wrap gap-2">
            <RecoveryChip attempt={task.attempt} />
            <TaskStatusChip status={task.status} audience="customer" />
          </div>
        </div>
        <p className="mt-1.5 text-sm text-muted">
          {task.attempt > 1 ? "" : `${attemptLabel(task.attempt)} · `}
          {adapterLabels[task.adapter]}
        </p>
        <p className="mt-1 font-mono text-xs text-muted tabular-nums">
          Due {formatSgtShort(task.dueBy)}
        </p>
      </div>
    </li>
  );
}

export function TaskList({ tasks }: { tasks: readonly TaskSummaryView[] }) {
  const ordered = inRunOrder(tasks, (task) => task.spotCode);
  return (
    <section aria-labelledby="tasks-heading">
      <SectionHeading id="tasks-heading" title="Physical tasks" />
      <p className="mt-2 max-w-2xl text-[15px] text-pretty text-muted">
        The work Datum commissioned and who holds it. Re-attempts at a spot are marked as recovery.
      </p>
      {ordered.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No tasks have been created yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {ordered.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </section>
  );
}
