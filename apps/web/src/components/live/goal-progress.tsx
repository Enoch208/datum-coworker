import { Cancel01Icon, HourglassIcon, RepairIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { SpotOutcome, SpotView } from "@datum/core";
import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";

const segmentTone: Record<SpotOutcome, string> = {
  PASS: "bg-ok",
  MISS: "bg-danger",
  PENDING: "bg-line-strong",
};

const segmentLabel: Record<SpotOutcome, { word: string; icon: IconSvgElement }> = {
  PASS: { word: "Pass", icon: Tick02Icon },
  MISS: { word: "Miss", icon: Cancel01Icon },
  PENDING: { word: "Waiting", icon: HourglassIcon },
};

const recoveringLabel = { word: "Recovering", icon: RepairIcon };

const isRecovering = (spot: SpotView): boolean =>
  spot.firstPassStatus === "MISS" && spot.status === "PENDING";

function Segment({ spot }: { spot: SpotView }) {
  const recovering = isRecovering(spot);
  const label = recovering ? recoveringLabel : segmentLabel[spot.status];
  return (
    <li className="min-w-0">
      <span
        aria-hidden
        className={cx(
          "block h-1.5 rounded-full",
          recovering ? "bg-warn motion-safe:animate-pulse" : segmentTone[spot.status],
        )}
      />
      <span className="mt-2.5 flex items-center gap-1.5 text-xs">
        <span className="font-mono text-ink">{spot.code}</span>
        <HugeiconsIcon
          icon={label.icon}
          size={12}
          strokeWidth={2}
          className="shrink-0 text-muted"
          aria-hidden
        />
        <span className="truncate text-muted">{label.word}</span>
      </span>
    </li>
  );
}

export function GoalProgress({
  passed,
  required,
  spots,
}: {
  passed: number;
  required: number;
  spots: readonly SpotView[];
}) {
  const columns: CSSProperties & Record<"--spots", string> = {
    "--spots": String(Math.max(spots.length, 1)),
  };
  return (
    <div>
      <p className="flex items-baseline gap-4">
        <span className="font-mono text-7xl leading-none font-extralight tracking-tighter tabular-nums sm:text-8xl">
          <span className="text-ink">{passed}</span>
          <span className="mx-1 text-faint">/</span>
          <span className="text-faint">{required}</span>
        </span>
      </p>
      <p className="mt-3 text-base text-muted">spots verified with their own photo</p>
      <ol
        aria-label="Spot by spot"
        className="mt-6 grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-[repeat(var(--spots),minmax(0,1fr))] sm:gap-y-2"
        style={columns}
      >
        {spots.map((spot) => (
          <Segment key={spot.id} spot={spot} />
        ))}
      </ol>
    </div>
  );
}
