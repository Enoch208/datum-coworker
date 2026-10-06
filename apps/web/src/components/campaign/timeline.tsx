import {
  AiBrain01Icon,
  CalculatorIcon,
  RunningShoesIcon,
  UserIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { TimelineActor, TimelineEventView } from "@datum/core";
import { useState } from "react";
import { quietButton } from "@/components/feedback/buttons";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { formatSgtMoment, formatSgtShort } from "@/lib/format";
import type { Resource } from "@/lib/use-resource";
import { SectionHeading } from "./section-heading";

const isoInstant = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})/g;

const readable = (summary: string): string =>
  summary.replace(isoInstant, (instant) => formatSgtShort(instant));

const actors: Record<TimelineActor, { label: string; icon: IconSvgElement }> = {
  CUSTOMER: { label: "You", icon: UserIcon },
  DATUM_AI: { label: "Datum AI", icon: AiBrain01Icon },
  DATUM_RULES: { label: "Datum rules", icon: CalculatorIcon },
  RUNNER: { label: "Runner", icon: RunningShoesIcon },
  MASUMI: { label: "Masumi", icon: Wallet01Icon },
};

function EventRow({ event }: { event: TimelineEventView }) {
  const actor = actors[event.actor];
  return (
    <li className="group relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 pb-7 last:pb-0">
      <span
        className="absolute top-8 bottom-0 left-[0.8125rem] w-px bg-line group-last:hidden"
        aria-hidden
      />
      <span className="relative flex size-7 items-center justify-center rounded-full border border-line-strong bg-canvas text-muted">
        <HugeiconsIcon icon={actor.icon} size={14} strokeWidth={1.8} aria-hidden />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm font-medium text-ink">{actor.label}</span>
          <time dateTime={event.at} className="font-mono text-xs text-muted tabular-nums">
            {formatSgtMoment(event.at)} SGT
          </time>
        </p>
        <p className="mt-1 text-[15px] break-words text-muted">{readable(event.summary)}</p>
      </div>
    </li>
  );
}

function TimelineSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading the timeline…</span>
      {["a", "b", "c"].map((key) => (
        <div key={key} aria-hidden className="flex gap-3">
          <div className="size-7 shrink-0 rounded-full bg-raised motion-safe:animate-pulse" />
          <div className="h-12 flex-1 rounded-lg bg-raised motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function EventList({
  events,
  recent,
}: {
  events: readonly TimelineEventView[];
  recent: number | undefined;
}) {
  const [all, setAll] = useState(false);
  const hidden = recent === undefined || all ? 0 : Math.max(0, events.length - recent);
  return (
    <>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => {
            setAll(true);
          }}
          className={`${quietButton} mb-6 -ml-3`}
        >
          Show {hidden} earlier {hidden === 1 ? "step" : "steps"}
        </button>
      )}
      <ol>
        {events.slice(hidden).map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </ol>
    </>
  );
}

export function Timeline({
  resource,
  recent,
}: {
  resource: Resource<TimelineEventView[]>;
  recent?: number;
}) {
  const { data, error } = resource;
  return (
    <section aria-labelledby="timeline-heading">
      <SectionHeading id="timeline-heading" title="Timeline" />
      <p className="mt-2 max-w-2xl text-[15px] font-light text-muted">
        Every step on record, oldest first, with who took it. Datum AI proposes; Datum rules check
        and decide; the runner does the physical work.
      </p>
      <div className="mt-8">
        {error !== null && data === null ? (
          <ErrorPanel
            title="The timeline could not be loaded"
            message={error.message}
            onRetry={resource.reload}
          />
        ) : data === null ? (
          <TimelineSkeleton />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted">Nothing has been recorded for this campaign yet.</p>
        ) : (
          <EventList events={data} recent={recent} />
        )}
      </div>
    </section>
  );
}
