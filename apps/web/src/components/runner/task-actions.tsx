import type { EvidenceView, ExpenseView, RunnerTaskView } from "@datum/core";
import { useCallback, useState } from "react";
import { EvidenceStep } from "./evidence-step";
import { ExpenseStep } from "./expense-step";
import { AcceptStep, CompleteStep } from "./runner-steps";
import { SettledStep } from "./settled-step";
import { awaitsAcceptance, isOpenForWork, shownEvidence, shownExpense } from "./task-facts";

const disputedCaution =
  "Datum disputes this receipt, so the amount does not count as spent yet. Send it again if you can.";

const failedCaution = (spotCode: string): string =>
  `Your latest photo did not pass, so Datum will treat Spot ${spotCode} as missed. Retake it if you can.`;

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
  if (!isOpenForWork(task.status)) {
    return <SettledStep task={task} evidence={evidence} expense={expense} inboxHref={inboxHref} />;
  }
  if (task.type === "PRINT_AND_COLLECT") {
    return (
      <>
        <ExpenseStep token={token} task={task} shown={expense} onSubmitted={onSubmitted} />
        {expense !== null && (
          <CompleteStep
            token={token}
            task={task}
            caution={expense.status === "DISPUTED" ? disputedCaution : null}
            onDone={reload}
          />
        )}
      </>
    );
  }
  return (
    <>
      <EvidenceStep token={token} task={task} shown={evidence} onUploaded={onUploaded} />
      {evidence !== null && evidence.verdict !== null && (
        <CompleteStep
          token={token}
          task={task}
          caution={evidence.verdict === "FAIL" ? failedCaution(task.spot?.code ?? "") : null}
          onDone={reload}
        />
      )}
    </>
  );
}
