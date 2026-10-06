import type { RunnerTaskView } from "@datum/core";
import { useParams } from "react-router";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Freshness } from "@/components/runner/freshness";
import { LinkInactive } from "@/components/runner/link-inactive";
import { RunnerSkeleton } from "@/components/runner/runner-skeleton";
import { inRunOrder, isHandedIn } from "@/components/runner/task-facts";
import { TaskRow } from "@/components/runner/task-row";
import { isInactiveLink } from "@/lib/runner-client";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useRunnerInbox } from "@/lib/use-runner-inbox";

function TaskGroup({
  title,
  tasks,
  empty,
}: {
  title: string;
  tasks: readonly RunnerTaskView[];
  empty?: string;
}) {
  if (tasks.length === 0 && empty === undefined) return null;
  return (
    <section className="mt-10">
      <h2 className="flex items-baseline gap-2 text-lg font-medium text-ink">
        {title}
        <span className="font-mono text-sm text-muted tabular-nums">{tasks.length}</span>
      </h2>
      {tasks.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line-strong p-5 text-[15px] text-muted">
          {empty}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskRow task={task} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RunnerInboxPage() {
  const { token = "" } = useParams();
  const inbox = useRunnerInbox(token);
  useDocumentTitle(isInactiveLink(inbox.error) ? "Link not active" : "Your tasks");

  if (isInactiveLink(inbox.error)) return <LinkInactive />;
  if (inbox.data === null) {
    if (inbox.error === null) return <RunnerSkeleton />;
    return (
      <ErrorPanel
        title="Your tasks could not be loaded"
        message={inbox.error.message}
        onRetry={inbox.reload}
      />
    );
  }
  const ordered = inRunOrder(inbox.data.tasks);
  return (
    <>
      <header>
        <p className="text-sm text-muted">Tasks for</p>
        <h1 className="mt-1 text-3xl font-light tracking-tight break-words">
          {inbox.data.runner.name}
        </h1>
        <div className="mt-3">
          <Freshness updatedAt={inbox.updatedAt} failing={inbox.error !== null} />
        </div>
      </header>
      <TaskGroup
        title="To do"
        tasks={ordered.filter((task) => !isHandedIn(task.status))}
        empty="Nothing to do right now. New tasks appear here on their own."
      />
      <TaskGroup title="Finished" tasks={ordered.filter((task) => isHandedIn(task.status))} />
    </>
  );
}
