import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { PublicCopy } from "@datum/core";
import { useState } from "react";
import { FieldError, controlBorder, controlClass } from "@/components/campaign-form/field";
import { primaryButton, quietButton } from "@/components/feedback/buttons";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { editCopy } from "@/lib/api-client";

export function CopyEditor({
  campaignId,
  initial,
  approved,
  onSaved,
  onCancel,
}: {
  campaignId: string;
  initial: PublicCopy;
  approved: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [headline, setHeadline] = useState(initial.headline);
  const [subcopy, setSubcopy] = useState(initial.subcopy);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const headlineError = checked && headline.trim() === "" ? "Write a headline." : undefined;
  const subcopyError = checked && subcopy.trim() === "" ? "Write the subcopy." : undefined;

  const save = () => {
    setChecked(true);
    if (headline.trim() === "" || subcopy.trim() === "") return;
    setBusy(true);
    setFailure(null);
    const copy = { headline: headline.trim(), subcopy: subcopy.trim() };
    void editCopy(campaignId, { copy }).then(
      () => {
        setBusy(false);
        onSaved();
      },
      (cause: unknown) => {
        setBusy(false);
        setFailure(cause instanceof Error ? cause.message : String(cause));
      },
    );
  };

  return (
    <form
      noValidate
      className="mt-6 flex flex-col gap-4 rounded-xl border border-line-strong p-5"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="copy-headline" className="text-sm font-medium text-ink">
          Headline
        </label>
        <input
          id="copy-headline"
          autoComplete="off"
          value={headline}
          onChange={(event) => {
            setHeadline(event.target.value);
          }}
          aria-invalid={headlineError !== undefined}
          className={`${controlClass} ${controlBorder(headlineError)} h-11`}
        />
        <FieldError id="copy-headline" error={headlineError} />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="copy-subcopy" className="text-sm font-medium text-ink">
          Subcopy
        </label>
        <textarea
          id="copy-subcopy"
          rows={3}
          value={subcopy}
          onChange={(event) => {
            setSubcopy(event.target.value);
          }}
          aria-invalid={subcopyError !== undefined}
          className={`${controlClass} ${controlBorder(subcopyError)} resize-y py-2.5 leading-relaxed`}
        />
        <FieldError id="copy-subcopy" error={subcopyError} />
      </div>
      <p className="flex gap-2 text-sm text-muted">
        <HugeiconsIcon
          icon={Alert02Icon}
          size={16}
          strokeWidth={1.8}
          className="mt-0.5 shrink-0 text-warn"
          aria-hidden
        />
        {approved
          ? "Saving replaces the approved copy. Every card is rendered again and Datum waits for a new approval before it acts."
          : "Saving renders every card again as a new version for you to approve."}
      </p>
      {failure !== null && <ErrorPanel title="The copy was not saved" message={failure} />}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={`${primaryButton} h-10 text-sm`}>
          {busy ? "Saving…" : "Save copy"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className={quietButton}>
          Cancel
        </button>
      </div>
    </form>
  );
}
