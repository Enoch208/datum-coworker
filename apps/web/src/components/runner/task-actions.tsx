import type { EvidenceView, ExpenseView, RunnerTaskView } from "@datum/core";
import { useCallback, useState } from "react";
import { EvidenceStep } from "./evidence-step";
import { ExpenseStep } from "./expense-step";
import { AcceptStep, CompleteStep } from "./runner-steps";
import { SettledStep } from "./settled-step";
import { awaitsAcceptance, shownEvidence, shownExpense } from "./task-facts";

export function TaskActions({
  token,
  task,
  inboxHref,
  reload,
}: {
  token: string;
  task: RunnerTaskView;
  inboxHref: string;
  reload: () => void;
}) {
  const [uploaded, setUploaded] = useState<EvidenceView | null>(null);
  const [submitted, setSubmitted] = useState<ExpenseView | null>(null);
  const evidence = shownEvidence(task, uploaded);
  const expense = shownExpense(task, submitted);
  const onUploaded = useCallback(
    (value: EvidenceView) => {
      setUploaded(value);
      reload();
    },
    [reload],
  );
  const onSubmitted = useCallback(
    (value: ExpenseView) => {
      setSubmitted(value);
      reload();
    },
    [reload],
  );

  if (awaitsAcceptance(task.status)) {
    return <AcceptStep token={token} task={task} onDone={reload} />;
  }
  if (task.status !== "ACCEPTED") {
    return <SettledStep task={task} evidence={evidence} expense={expense} inboxHref={inboxHref} />;
  }
  if (task.type === "PRINT_AND_COLLECT") {
    return (
      <>
        <ExpenseStep token={token} task={task} shown={expense} onSubmitted={onSubmitted} />
        {expense !== null && expense.status !== "DISPUTED" && (
          <CompleteStep token={token} task={task} onDone={reload} />
        )}
      </>
    );
  }
  return (
    <>
      <EvidenceStep token={token} task={task} shown={evidence} onUploaded={onUploaded} />
      {evidence?.verdict === "PASS" && <CompleteStep token={token} task={task} onDone={reload} />}
    </>
  );
}
