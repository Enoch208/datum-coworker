import { Alert02Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CampaignView, ProposalView } from "@datum/core";
import { useState } from "react";
import { FieldError, controlBorder, controlClass } from "@/components/campaign-form/field";
import { primaryButton } from "@/components/feedback/buttons";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { approveCampaign, startCampaign } from "@/lib/api-client";
import { ApiRequestError } from "@/lib/http";
import { formatSgt, formatWireMoney, shortHash } from "@/lib/format";
import { BoundsList, Mono, SpotCodes } from "./bounds-list";

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

const staleText =
  "The proposal changed while you were reviewing it, so this approval was not recorded. The page now shows the latest version; check it and approve again.";

function NewApprovalNotice({ version }: { version: number }) {
  return (
    <div className="mb-5 flex gap-3 rounded-xl border border-warn/40 bg-warn/5 p-4 text-sm">
      <HugeiconsIcon
        icon={Alert02Icon}
        size={18}
        strokeWidth={1.8}
        className="mt-0.5 shrink-0 text-warn"
        aria-hidden
      />
      <p className="text-ink">
        New approval required. The copy changed after the last approval, so version{" "}
        <span className="font-mono">{version}</span> is not approved and nothing launches until it
        is.
      </p>
    </div>
  );
}

function boundsRows(campaign: CampaignView, proposal: ProposalView) {
  return [
    { label: "Public copy", value: proposal.copy.headline },
    {
      label: "Card design",
      value: (
        <Mono title={proposal.assetHash}>
          v{proposal.assetVersion} · {shortHash(proposal.assetHash)}
        </Mono>
      ),
    },
    { label: "Spots", value: <SpotCodes codes={campaign.spots.map((spot) => spot.code)} /> },
    { label: "Budget cap", value: <Mono>{formatWireMoney(campaign.budget)}</Mono> },
    { label: "Deadline", value: <Mono>{formatSgt(campaign.deadline)}</Mono> },
    { label: "Proof", value: "One photo per spot showing that spot's own QR code" },
  ];
}

export function ApprovalPanel({
  campaign,
  proposal,
  stale,
  onChanged,
  onStartFailed,
}: {
  campaign: CampaignView;
  proposal: ProposalView;
  stale: boolean;
  onChanged: () => void;
  onStartFailed: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<"idle" | "approving" | "starting">("idle");
  const [failure, setFailure] = useState<string | null>(null);
  const busy = phase !== "idle";

  const start = () => {
    setPhase("starting");
    void startCampaign(campaign.id).then(
      () => {
        setPhase("idle");
        onChanged();
      },
      (cause: unknown) => {
        setPhase("idle");
        onStartFailed(messageOf(cause));
        onChanged();
      },
    );
  };

  const approve = () => {
    if (name.trim().length === 0) {
      setNameError("Type your name to sign the approval.");
      document.getElementById("approved-by")?.focus();
      return;
    }
    setPhase("approving");
    setFailure(null);
    const request = { assetVersion: proposal.assetVersion, approvedBy: name.trim() };
    void approveCampaign(campaign.id, request).then(start, (cause: unknown) => {
      setPhase("idle");
      const conflict = cause instanceof ApiRequestError && cause.status === 409;
      setFailure(conflict ? staleText : messageOf(cause));
      if (conflict) onChanged();
    });
  };

  return (
    <section
      aria-labelledby="approve-heading"
      className="rounded-2xl border border-line bg-surface p-6 min-[1200px]:flex min-[1200px]:min-h-0 min-[1200px]:flex-col"
    >
      {stale && <NewApprovalNotice version={proposal.assetVersion} />}
      <h2 id="approve-heading" className="text-xl font-normal tracking-tight text-ink">
        What you approve
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        One approval locks all of this. Nothing is printed, placed or spent before it.
      </p>
      <div className="mt-5 min-[1200px]:min-h-0 min-[1200px]:overflow-y-auto min-[1200px]:pb-6 min-[1200px]:[mask-image:linear-gradient(to_bottom,black_calc(100%-1.5rem),transparent)]">
        <BoundsList rows={boundsRows(campaign, proposal)} />
      </div>
      <form
        noValidate
        className="mt-6 flex shrink-0 flex-col gap-2 min-[1200px]:mt-0"
        onSubmit={(event) => {
          event.preventDefault();
          approve();
        }}
      >
        <label htmlFor="approved-by" className="text-sm font-medium text-ink">
          Your name
        </label>
        <input
          id="approved-by"
          name="approvedBy"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setNameError(undefined);
          }}
          aria-invalid={nameError !== undefined}
          aria-describedby={nameError === undefined ? undefined : "approved-by-error"}
          className={`${controlClass} ${controlBorder(nameError)} h-11`}
        />
        <FieldError id="approved-by" error={nameError} />
        {failure !== null && (
          <div className="mt-2">
            <ErrorPanel title="Not approved" message={failure} />
          </div>
        )}
        <button type="submit" disabled={busy} className={`${primaryButton} mt-3 w-full`}>
          {busy && (
            <HugeiconsIcon
              icon={Loading03Icon}
              size={18}
              strokeWidth={2}
              className="animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          )}
          {phase === "approving"
            ? "Approving…"
            : phase === "starting"
              ? "Starting…"
              : "Approve and launch"}
        </button>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          After approval Datum works on its own within these bounds. Changing the copy or the spots,
          or raising the budget, needs a new approval.
        </p>
      </form>
    </section>
  );
}
