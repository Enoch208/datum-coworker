import { Alert02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CampaignView, ProposalView } from "@datum/core";
import { useState } from "react";
import { quietButton } from "@/components/feedback/buttons";
import { CopyEditor } from "./copy-editor";
import { ProposalCopy } from "./proposal-copy";

function EditedNotice({ version }: { version: number }) {
  return (
    <p
      role="status"
      className="mt-5 flex gap-3 rounded-xl border border-warn/40 bg-warn/5 p-4 text-sm text-ink"
    >
      <HugeiconsIcon
        icon={Alert02Icon}
        size={18}
        strokeWidth={1.8}
        className="mt-0.5 shrink-0 text-warn"
        aria-hidden
      />
      <span>
        Copy saved as version <span className="font-mono">{version}</span>. Every card was rendered
        again, and this version needs your approval before anything is printed or placed.
      </span>
    </p>
  );
}

export function CopySection({
  campaign,
  proposal,
  approved,
  editable,
  onSaved,
}: {
  campaign: CampaignView;
  proposal: ProposalView;
  approved: boolean;
  editable: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [savedFrom, setSavedFrom] = useState<number | null>(null);
  const edit = (
    <button
      type="button"
      onClick={() => {
        setEditing(true);
      }}
      className={quietButton}
    >
      <HugeiconsIcon icon={PencilEdit02Icon} size={16} strokeWidth={1.8} aria-hidden />
      Edit copy
    </button>
  );
  return (
    <div>
      <ProposalCopy proposal={proposal} {...(editable && !editing ? { action: edit } : {})} />
      {editing && (
        <CopyEditor
          campaignId={campaign.id}
          initial={proposal.copy}
          approved={approved}
          onCancel={() => {
            setEditing(false);
          }}
          onSaved={() => {
            setEditing(false);
            setSavedFrom(proposal.assetVersion);
            onSaved();
          }}
        />
      )}
      {savedFrom !== null && savedFrom !== proposal.assetVersion && !approved && (
        <EditedNotice version={proposal.assetVersion} />
      )}
    </div>
  );
}
