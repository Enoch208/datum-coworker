import type { EvidenceView, PhysicalTaskStatus, RunnerTaskView } from "@datum/core";
import { useCallback, useState } from "react";
import { Link } from "react-router";
import { touchSecondary } from "@/components/feedback/buttons";
import { EvidenceStep } from "./evidence-step";
import { AcceptStep, CompleteStep } from "./runner-steps";
import { StepFrame, StepText } from "./step-frame";
import { awaitsAcceptance } from "./task-facts";
import { VerdictView } from "./verdict-view";

const settledText: Partial<Record<PhysicalTaskStatus, { title: string; text: string }>> = {
  SUBMITTED: {
    title: "Handed in",
    text: "Thank you. Datum checks the proof for every spot before the campaign counts as live.",
  },
  COMPLETED: { title: "Done", text: "Thank you. Nothing more is needed for this task." },
  CANCELLED: {
    title: "Cancelled",
    text: "Datum cancelled this task. You do not need to do anything more for it.",
  },
  EXPIRED: {
    title: "Past its due time",
    text: "This task can no longer be handed in. If Datum needs this spot again, the new task appears in your list.",
  },
};

function latestEvidence(evidence: readonly EvidenceView[]): EvidenceView | null {
  return evidence.reduce<EvidenceView | null>(
    (latest, item) =>
      latest === null || Date.parse(item.submittedAt) >= Date.parse(latest.submittedAt)
        ? item
        : latest,
    null,
  );
}

function shownEvidence(task: RunnerTaskView, uploaded: EvidenceView | null): EvidenceView | null {
  if (uploaded === null) return latestEvidence(task.evidence);
  return task.evidence.find((item) => item.id === uploaded.id) ?? uploaded;
}

function Settled({
  task,
  shown,
  inboxHref,
}: {
  task: RunnerTaskView;
  shown: EvidenceView | null;
  inboxHref: string;
}) {
  const copy = settledText[task.status];
  return (
    <StepFrame title={copy?.title ?? "Handed in"}>
      {copy !== undefined && <StepText>{copy.text}</StepText>}
      {shown !== null && <VerdictView evidence={shown} spotCode={task.spot?.code ?? ""} />}
      <Link to={inboxHref} className={touchSecondary}>
        Back to all tasks
      </Link>
    </StepFrame>
  );
}

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
  const shown = shownEvidence(task, uploaded);
  const onUploaded = useCallback(
    (evidence: EvidenceView) => {
      setUploaded(evidence);
      reload();
    },
    [reload],
  );

  if (awaitsAcceptance(task.status))
    return <AcceptStep token={token} task={task} onDone={reload} />;
  if (task.status !== "ACCEPTED")
    return <Settled task={task} shown={shown} inboxHref={inboxHref} />;
  if (task.type !== "PLACE_SPOT") return null;
  return (
    <>
      <EvidenceStep token={token} task={task} shown={shown} onUploaded={onUploaded} />
      {shown?.verdict === "PASS" && <CompleteStep token={token} task={task} onDone={reload} />}
    </>
  );
}
