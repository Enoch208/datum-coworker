import { Cancel01Icon, FileDownloadIcon, ZoomInAreaIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { RunnerTaskView, SpotCardView } from "@datum/core";
import { useRef } from "react";
import { touchPrimary, touchSecondary } from "@/components/feedback/buttons";

function CardFigure({
  card,
  label,
  printable,
}: {
  card: SpotCardView;
  label: string;
  printable: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => {
    dialog.current?.close();
  };
  return (
    <li className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="relative block w-full overflow-hidden rounded-2xl border border-line bg-raised"
      >
        <img src={card.pngUrl} alt={label} className="block w-full" />
        <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-canvas/85 px-3 py-1.5 text-sm text-ink">
          <HugeiconsIcon icon={ZoomInAreaIcon} size={16} strokeWidth={1.8} aria-hidden />
          Tap to enlarge
        </span>
      </button>
      {printable && (
        <a href={card.pdfUrl} download className={touchSecondary}>
          <HugeiconsIcon icon={FileDownloadIcon} size={18} strokeWidth={1.8} aria-hidden />
          Print file (PDF)
        </a>
      )}
      <dialog
        ref={dialog}
        aria-label={label}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-canvas p-0 text-ink backdrop:bg-canvas"
      >
        <div className="flex h-full flex-col gap-4 p-4">
          <img src={card.pngUrl} alt={label} className="min-h-0 flex-1 object-contain" />
          <button type="button" onClick={close} className={touchPrimary}>
            <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} aria-hidden />
            Close
          </button>
        </div>
      </dialog>
    </li>
  );
}

export function CardGallery({ task }: { task: RunnerTaskView }) {
  if (task.cards.length === 0) return null;
  const printable = task.type === "PRINT_AND_COLLECT";
  const heading = task.spot === null ? "The cards to print" : `The card for Spot ${task.spot.code}`;
  const label = (index: number) =>
    task.spot === null
      ? `Print card ${String(index + 1)} of ${String(task.cards.length)}`
      : `Card for Spot ${task.spot.code}, with that spot's own QR code`;
  return (
    <section className="mt-12">
      <h2 className="text-lg font-medium text-ink">{heading}</h2>
      <p className="mt-1 text-[15px] text-muted">
        {printable
          ? "Each card has its own QR code. Print every one."
          : "Use this exact card. Its QR code belongs to this spot only."}
      </p>
      <ul className="mt-4 flex flex-col gap-8">
        {task.cards.map((card, index) => (
          <CardFigure key={card.pngUrl} card={card} label={label(index)} printable={printable} />
        ))}
      </ul>
    </section>
  );
}
