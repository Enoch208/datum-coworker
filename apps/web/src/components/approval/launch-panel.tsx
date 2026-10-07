import { HourglassIcon, Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { primaryButton } from "@/components/feedback/buttons";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { startCampaign } from "@/lib/api-client";
import { isPaymentWait, startFailureOf, type StartFailure } from "./start-failure";

function StartButton({
  busy,
  retry,
  onStart,
}: {
  busy: boolean;
  retry: boolean;
  onStart: () => void;
}) {
  return (
    <button type="button" onClick={onStart} disabled={busy} className={`${primaryButton} w-full`}>
      {busy && (
        <HugeiconsIcon
          icon={Loading03Icon}
          size={18}
          strokeWidth={2}
          className="animate-spin motion-reduce:animate-none"
          aria-hidden
        />
      )}
      {busy ? "Starting…" : retry ? "Try starting again" : "Start the campaign"}
    </button>
  );
}

export function LaunchPanel({
  campaignId,
  failure,
  onResult,
}: {
  campaignId: string;
  failure: StartFailure | null;
  onResult: (failure: StartFailure | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const waitingForPayment = isPaymentWait(failure);

  const start = () => {
    setBusy(true);
    void startCampaign(campaignId).then(
      () => {
        setBusy(false);
        onResult(null);
      },
      (cause: unknown) => {
        setBusy(false);
        onResult(startFailureOf(cause));
      },
    );
  };

  return (
    <section
      aria-labelledby="launch-heading"
      className={`flex flex-col gap-4 rounded-2xl border p-6 ${waitingForPayment ? "border-line-strong bg-surface" : "border-warn/40 bg-warn/5"}`}
    >
      <div className={`flex items-center gap-2 ${waitingForPayment ? "text-ink" : "text-warn"}`}>
        <HugeiconsIcon icon={HourglassIcon} size={18} strokeWidth={1.8} aria-hidden />
        <h2 id="launch-heading" className="text-base font-medium">
          {waitingForPayment ? "Approved, waiting for payment" : "Approved, not started yet"}
        </h2>
      </div>
      <p className="text-sm text-muted">
        Your approval is saved. No physical work has started and none of your campaign budget is
        spent. Datum starts within the limits you approved, and if the plan no longer fits them it
        stops and asks first.
      </p>
      {waitingForPayment ? (
        <p className="text-sm text-ink">
          Datum starts on its own as soon as the payment for its Sokosumi Task is confirmed in
          escrow. There is nothing for you to do.
        </p>
      ) : (
        <>
          {failure !== null && (
            <ErrorPanel title="Datum could not start yet" message={failure.message} />
          )}
          <StartButton busy={busy} retry={failure !== null} onStart={start} />
        </>
      )}
    </section>
  );
}
