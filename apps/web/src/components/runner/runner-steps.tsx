import { CheckmarkCircle02Icon, UserCheck01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { RunnerTaskView } from "@datum/core";
import { useCallback } from "react";
import { touchPrimary } from "@/components/feedback/buttons";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { acceptTask, completeTask } from "@/lib/runner-client";
import { Spinner } from "./step-buttons";
import { StepFrame, StepText } from "./step-frame";
import { useAction, type ActionState } from "./use-action";

const nextAfterAccept = {
  PLACE_SPOT: "take the evidence photo",
  PRINT_AND_COLLECT: "send the receipt",
} as const;

const afterDone = {
  PLACE_SPOT:
    "Marking done tells Datum your part is finished. The campaign itself is complete only when Datum has verified a photo for every spot.",
  PRINT_AND_COLLECT:
    "Marking done tells Datum the cards are printed and in your hands. The campaign itself is complete only when Datum has verified a photo for every spot.",
} as const;

function ActionButton({
  state,
  onClick,
  labels,
  icon,
}: {
  state: ActionState;
  onClick: () => void;
  labels: Record<ActionState, string>;
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
}) {
  return (
    <button type="button" onClick={onClick} disabled={state !== "ready"} className={touchPrimary}>
      {state === "busy" ? (
        <Spinner />
      ) : (
        <HugeiconsIcon icon={icon} size={20} strokeWidth={1.8} aria-hidden />
      )}
      {labels[state]}
    </button>
  );
}

export function AcceptStep({
  token,
  task,
  onDone,
}: {
  token: string;
  task: RunnerTaskView;
  onDone: () => void;
}) {
  const run = useCallback(() => acceptTask(token, task.id), [token, task.id]);
  const action = useAction(run, onDone);
  return (
    <StepFrame title="Can you take this on?">
      <StepText>
        Accept to tell Datum you are on it. Then {nextAfterAccept[task.type]} here.
      </StepText>
      {action.error !== null && <ErrorPanel title="Not accepted yet" message={action.error} />}
      <ActionButton
        state={action.state}
        onClick={action.trigger}
        icon={UserCheck01Icon}
        labels={{ ready: "Accept task", busy: "Accepting…", done: "Accepted" }}
      />
    </StepFrame>
  );
}

export function CompleteStep({
  token,
  task,
  onDone,
}: {
  token: string;
  task: RunnerTaskView;
  onDone: () => void;
}) {
  const run = useCallback(() => completeTask(token, task.id), [token, task.id]);
  const action = useAction(run, onDone);
  return (
    <StepFrame title="Finished here?">
      <StepText>{afterDone[task.type]}</StepText>
      {action.error !== null && <ErrorPanel title="Not marked done" message={action.error} />}
      <ActionButton
        state={action.state}
        onClick={action.trigger}
        icon={CheckmarkCircle02Icon}
        labels={{ ready: "Mark done", busy: "Marking done…", done: "Marked done" }}
      />
    </StepFrame>
  );
}
