import { ArrowRight01Icon, Clock01Icon, PrinterIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { RunnerTaskView } from "@datum/core";
import { Link } from "react-router";
import { RecoveryChip, TaskStatusChip } from "@/components/status/task-status-chip";
import { formatSgtShort } from "@/lib/format";
import { taskTitle } from "./task-facts";

export function TaskBadge({ task }: { task: RunnerTaskView }) {
  return (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-canvas font-mono text-xl text-ink">
      {task.spot === null ? (
        <HugeiconsIcon icon={PrinterIcon} size={22} strokeWidth={1.6} aria-label="Print" />
      ) : (
        task.spot.code
      )}
    </span>
  );
}

export function DueLine({ dueBy }: { dueBy: string }) {
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted">
      <HugeiconsIcon icon={Clock01Icon} size={16} strokeWidth={1.8} aria-hidden />
      Due{" "}
      <time dateTime={dueBy} className="font-mono text-ink tabular-nums">
        {formatSgtShort(dueBy)}
      </time>
    </p>
  );
}

export function TaskRow({ task, href }: { task: RunnerTaskView; href: string }) {
  return (
    <Link
      to={href}
      className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 active:bg-raised"
    >
      <TaskBadge task={task} />
      <div className="min-w-0 flex-1">
        <p className="text-[17px] leading-snug font-medium break-words text-ink">
          {taskTitle(task)}
        </p>
        <p className="mt-0.5 text-[15px] break-words text-muted">
          {task.spot === null ? task.brandName : `${task.spot.name} · ${task.brandName}`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <TaskStatusChip status={task.status} audience="runner" />
          <RecoveryChip attempt={task.attempt} />
        </div>
        <div className="mt-3">
          <DueLine dueBy={task.dueBy} />
        </div>
      </div>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        size={20}
        strokeWidth={1.8}
        className="shrink-0 text-muted"
        aria-hidden
      />
    </Link>
  );
}
