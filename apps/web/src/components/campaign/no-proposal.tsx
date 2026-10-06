import { Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CampaignView } from "@datum/core";
import { useState } from "react";
import { primaryButton } from "@/components/feedback/buttons";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { requestPlan } from "@/lib/api-client";

const draftingText = "Drafting the campaign and rendering one card per spot…";

function Drafting() {
  return (
    <p role="status" className="flex items-center gap-3 text-[15px] text-muted">
      <HugeiconsIcon
        icon={Loading03Icon}
        size={18}
        strokeWidth={2}
        className="animate-spin motion-reduce:animate-none"
        aria-hidden
      />
      {draftingText}
    </p>
  );
}

export function NoProposal({
  campaign,
  earlierFailure,
  onPlanned,
}: {
  campaign: CampaignView;
  earlierFailure: string | null;
  onPlanned: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(earlierFailure);

  const draft = () => {
    setBusy(true);
    setFailure(null);
    void requestPlan(campaign.id).then(
      () => {
        setBusy(false);
        onPlanned();
      },
      (cause: unknown) => {
        setBusy(false);
        setFailure(cause instanceof Error ? cause.message : String(cause));
      },
    );
  };

  return (
    <section
      aria-labelledby="no-proposal-heading"
      className="rounded-2xl border border-line bg-surface p-6 sm:p-8"
    >
      <h2 id="no-proposal-heading" className="text-2xl font-light tracking-tight">
        No proposal yet
      </h2>
      <p className="mt-3 max-w-2xl text-[15px] font-light text-muted">
        Datum has not drafted the copy, the plan and the cards for this campaign. Nothing can be
        approved until it has.
      </p>
      {failure !== null && (
        <div className="mt-6">
          <ErrorPanel title="The planner did not finish" message={failure} />
        </div>
      )}
      <div className="mt-6">
        {campaign.status === "PLANNING" || busy ? (
          <Drafting />
        ) : (
          <button type="button" onClick={draft} className={primaryButton}>
            {failure === null ? "Draft the proposal" : "Try drafting again"}
          </button>
        )}
      </div>
    </section>
  );
}
