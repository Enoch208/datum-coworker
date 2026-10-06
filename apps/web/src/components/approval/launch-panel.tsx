import { HourglassIcon, Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { primaryButton } from "@/components/feedback/buttons";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { startCampaign } from "@/lib/api-client";

export function LaunchPanel({
  campaignId,
  failure,
  onResult,
}: {
  campaignId: string;
  failure: string | null;
  onResult: (failure: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  const start = () => {
    setBusy(true);
    void startCampaign(campaignId).then(
      () => {
        setBusy(false);
        onResult(null);
      },
      (cause: unknown) => {
        setBusy(false);
        onResult(cause instanceof Error ? cause.message : String(cause));
      },
    );
  };

  return (
    <section
      aria-labelledby="launch-heading"
      className="flex flex-col gap-4 rounded-2xl border border-warn/40 bg-warn/5 p-6"
    >
      <div className="flex items-center gap-2 text-warn">
        <HugeiconsIcon icon={HourglassIcon} size={18} strokeWidth={1.8} aria-hidden />
        <h2 id="launch-heading" className="text-base font-medium">
          Approved, not started
        </h2>
      </div>
      <p className="text-sm text-muted">
        Your approval is recorded, but Datum has not started the work. Starting uses the approval
        below exactly as it is; nothing is approved again.
      </p>
      {failure !== null && <ErrorPanel title="Datum could not start" message={failure} />}
      <button type="button" onClick={start} disabled={busy} className={`${primaryButton} w-full`}>
        {busy && (
          <HugeiconsIcon
            icon={Loading03Icon}
            size={18}
            strokeWidth={2}
            className="animate-spin motion-reduce:animate-none"
            aria-hidden
          />
        )}
        {busy ? "Starting…" : "Start the campaign"}
      </button>
    </section>
  );
}
