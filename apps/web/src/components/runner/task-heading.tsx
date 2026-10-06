import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { RunnerTaskView } from "@datum/core";
import { Link } from "react-router";
import { RecoveryChip, TaskStatusChip } from "@/components/status/task-status-chip";
import { Freshness } from "./freshness";
import { taskTitle } from "./task-facts";
import { DueLine, TaskBadge } from "./task-row";

export function BackToTasks({ href }: { href: string }) {
  return (
    <Link
      to={href}
      className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-[15px] text-muted active:bg-raised"
    >
      <HugeiconsIcon icon={ArrowLeft01Icon} size={18} strokeWidth={1.8} aria-hidden />
      All tasks
    </Link>
  );
}

export function TaskHeading({
  task,
  inboxHref,
  updatedAt,
  failing,
}: {
  task: RunnerTaskView;
  inboxHref: string;
  updatedAt: number | null;
  failing: boolean;
}) {
  return (
    <header>
      <BackToTasks href={inboxHref} />
      <div className="mt-4 flex flex-wrap gap-2">
        <TaskStatusChip status={task.status} audience="runner" />
        <RecoveryChip attempt={task.attempt} />
      </div>
      <h1 className="mt-4 text-3xl leading-tight font-light tracking-tight break-words">
        {taskTitle(task)}
      </h1>
      <p className="mt-2 text-[15px] text-muted">{task.brandName}</p>
      <div className="mt-4 flex flex-col gap-2">
        <DueLine dueBy={task.dueBy} />
        <Freshness updatedAt={updatedAt} failing={failing} />
      </div>
    </header>
  );
}

export function WhereAndWhat({ task }: { task: RunnerTaskView }) {
  return (
    <section className="mt-8 flex flex-col gap-4">
      {task.spot !== null && (
        <div className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
          <TaskBadge task={task} />
          <div className="min-w-0">
            <p className="text-lg font-medium break-words text-ink">{task.spot.name}</p>
            <p className="mt-1 text-[15px] break-words text-muted">{task.spot.instructions}</p>
          </div>
        </div>
      )}
      <div>
        <h2 className="text-sm text-muted">What to do</h2>
        <p className="mt-1.5 text-lg leading-snug break-words text-ink">{task.instructions}</p>
      </div>
    </section>
  );
}
