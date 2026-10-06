import { Camera01Icon, SentIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { EvidenceView, RunnerTaskView } from "@datum/core";
import { useCallback, useEffect, useRef } from "react";
import { touchPrimary } from "@/components/feedback/buttons";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { uploadEvidence } from "@/lib/runner-client";
import { PhotoButton, SendProgress } from "./step-buttons";
import { StepFrame, StepText } from "./step-frame";
import { useChosenPhoto } from "./use-chosen-photo";
import { useUpload } from "./use-upload";
import { VerdictView } from "./verdict-view";

const guidance = "Fill most of the photo with the card so its QR code is sharp.";

export function EvidenceStep({
  token,
  task,
  shown,
  onUploaded,
}: {
  token: string;
  task: RunnerTaskView;
  shown: EvidenceView | null;
  onUploaded: (evidence: EvidenceView) => void;
}) {
  const { chosen, choose } = useChosenPhoto();
  const frame = useRef<HTMLElement>(null);
  useEffect(() => {
    if (chosen !== null) frame.current?.scrollIntoView({ block: "start" });
  }, [chosen]);
  const finished = useCallback(
    (evidence: EvidenceView) => {
      choose(null);
      onUploaded(evidence);
    },
    [choose, onUploaded],
  );
  const upload = useUpload(finished);
  const spotCode = task.spot?.code ?? "";
  const sending = upload.state.kind === "sending";
  const pick = (file: File) => {
    upload.reset();
    choose(file);
  };

  if (chosen !== null) {
    const send = () => {
      upload.start((onProgress) => uploadEvidence(token, task.id, chosen.file, onProgress));
    };
    return (
      <StepFrame title="Check your photo" ref={frame}>
        <img
          src={chosen.previewUrl}
          alt="The photo you are about to send"
          className="max-h-[50vh] w-full rounded-xl border border-line bg-raised object-contain"
        />
        {upload.state.kind === "sending" && (
          <SendProgress fraction={upload.state.fraction} what="photo" />
        )}
        {upload.state.kind === "failed" && (
          <ErrorPanel title="The photo was not sent" message={upload.state.message} />
        )}
        <button type="button" onClick={send} disabled={sending} className={touchPrimary}>
          <HugeiconsIcon icon={SentIcon} size={20} strokeWidth={1.8} aria-hidden />
          {upload.state.kind === "failed" ? "Send again" : "Send this photo"}
        </button>
        <PhotoButton
          id="evidence-retake"
          label="Retake"
          icon={Camera01Icon}
          primary={false}
          disabled={sending}
          onChosen={pick}
        />
      </StepFrame>
    );
  }

  if (shown !== null) {
    return (
      <StepFrame title="Your photo">
        <VerdictView evidence={shown} spotCode={spotCode} />
        {shown.verdict === "FAIL" && (
          <>
            <StepText>{guidance}</StepText>
            <PhotoButton
              id="evidence-again"
              label="Retake photo"
              icon={Camera01Icon}
              primary
              onChosen={pick}
            />
          </>
        )}
      </StepFrame>
    );
  }

  return (
    <StepFrame title="Take the evidence photo">
      <StepText>
        Place the card at Spot {spotCode} first. {guidance}
      </StepText>
      <PhotoButton
        id="evidence-photo"
        label="Take evidence photo"
        icon={Camera01Icon}
        primary
        onChosen={pick}
      />
    </StepFrame>
  );
}
