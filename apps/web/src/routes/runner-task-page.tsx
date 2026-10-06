import { useParams } from "react-router";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { CardGallery } from "@/components/runner/card-gallery";
import { LinkInactive } from "@/components/runner/link-inactive";
import { RunnerSkeleton } from "@/components/runner/runner-skeleton";
import { TaskActions } from "@/components/runner/task-actions";
import { isFinished } from "@/components/runner/task-facts";
import { BackToTasks, TaskHeading, WhereAndWhat } from "@/components/runner/task-heading";
import { isInactiveLink } from "@/lib/runner-client";
import { runnerHref } from "@/lib/routes";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useRunnerInbox } from "@/lib/use-runner-inbox";

function TaskMissing({ inboxHref }: { inboxHref: string }) {
  return (
    <section>
      <BackToTasks href={inboxHref} />
      <h1 className="mt-6 text-3xl font-light tracking-tight">This task is not in your list</h1>
      <p className="mt-4 text-lg font-light text-muted">
        It may have been replaced by a newer task. Your current tasks are in the list.
      </p>
    </section>
  );
}

export function RunnerTaskPage() {
  const { token = "", taskId = "" } = useParams();
  const inbox = useRunnerInbox(token);
  const inactive = isInactiveLink(inbox.error);
  useDocumentTitle(inactive ? "Link not active" : "Task");
  const inboxHref = runnerHref(token);

  if (inactive) return <LinkInactive />;
  if (inbox.data === null) {
    if (inbox.error === null) return <RunnerSkeleton />;
    return (
      <ErrorPanel
        title="This task could not be loaded"
        message={inbox.error.message}
        onRetry={inbox.reload}
      />
    );
  }
  const task = inbox.data.tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) return <TaskMissing inboxHref={inboxHref} />;
  return (
    <>
      <TaskHeading
        task={task}
        inboxHref={inboxHref}
        updatedAt={inbox.updatedAt}
        failing={inbox.error !== null}
      />
      <WhereAndWhat task={task} />
      <TaskActions
        key={task.id}
        token={token}
        task={task}
        inboxHref={inboxHref}
        reload={inbox.reload}
      />
      {!isFinished(task.status) && <CardGallery task={task} />}
    </>
  );
}
