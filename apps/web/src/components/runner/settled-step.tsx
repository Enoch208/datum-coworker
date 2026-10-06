import type { EvidenceView, ExpenseView, PhysicalTaskStatus, RunnerTaskView } from "@datum/core";
import { Link } from "react-router";
import { touchSecondary } from "@/components/feedback/buttons";
import { ExpenseRecord } from "./expense-record";
import { StepFrame, StepText } from "./step-frame";
import { VerdictView } from "./verdict-view";

const settledText: Partial<Record<PhysicalTaskStatus, { title: string; text: string }>> = {
  COMPLETED: {
    title: "Done",
    text: "Thank you. Nothing more is needed for this task. Datum checks the proof for every spot before the campaign counts as live.",
  },
  CANCELLED: {
    title: "Cancelled",
    text: "Datum cancelled this task. You do not need to do anything more for it.",
  },
  EXPIRED: {
    title: "Past its due time",
    text: "This task can no longer be handed in. If Datum needs this spot again, the new task appears in your list.",
  },
};

export function SettledStep({
  task,
  evidence,
  expense,
  inboxHref,
}: {
  task: RunnerTaskView;
  evidence: EvidenceView | null;
  expense: ExpenseView | null;
  inboxHref: string;
}) {
  const copy = settledText[task.status];
  return (
    <StepFrame title={copy?.title ?? "Finished"}>
      {copy !== undefined && <StepText>{copy.text}</StepText>}
      {evidence !== null && <VerdictView evidence={evidence} spotCode={task.spot?.code ?? ""} />}
      {expense !== null && <ExpenseRecord expense={expense} />}
      <Link to={inboxHref} className={touchSecondary}>
        Back to all tasks
      </Link>
    </StepFrame>
  );
}
