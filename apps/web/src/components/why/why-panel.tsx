import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { GoalStateView } from "@datum/core";
import { useState, type ReactNode } from "react";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { cx } from "@/lib/cx";
import type { Resource } from "@/lib/use-resource";
import { DecisionTrail } from "./decision-trail";
import { GoalPosition } from "./goal-position";
import { RequirementsTable } from "./requirements-table";

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="eyebrow text-muted">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function WhyBody({ goal }: { goal: GoalStateView }) {
  return (
    <div className="flex flex-col gap-12">
      <Part title="Requirements">
        <RequirementsTable goal={goal} />
      </Part>
      <Part title="Where it stands">
        <GoalPosition goal={goal} />
      </Part>
      <Part title="Latest recovery decision">
        {goal.latestDecision === null ? (
          <p className="text-[15px] text-muted">
            No recovery has been needed. Everything commissioned so far comes straight from the
            approved plan.
          </p>
        ) : (
          <DecisionTrail decision={goal.latestDecision} />
        )}
      </Part>
    </div>
  );
}

function WhyContent({ resource }: { resource: Resource<GoalStateView | null> }) {
  if (resource.data !== null) return <WhyBody goal={resource.data} />;
  if (resource.error !== null) {
    return (
      <ErrorPanel
        title="The goal state could not be read"
        message={resource.error.message}
        onRetry={resource.reload}
      />
    );
  }
  return (
    <p role="status" className="text-sm text-muted">
      Reading the goal state…
    </p>
  );
}

export function WhyPanel({ goal }: { goal: Resource<GoalStateView | null> }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="why-heading" className="rounded-2xl border border-line bg-surface">
      <h2 id="why-heading">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="why-body"
          onClick={() => {
            setOpen((value) => !value);
          }}
          className="flex w-full items-start justify-between gap-4 rounded-2xl p-5 text-left hover:bg-raised/60 sm:p-6"
        >
          <span>
            <span className="block text-2xl font-normal tracking-tight text-ink">
              Why Datum did that
            </span>
            <span className="mt-1.5 block text-[15px] text-pretty text-muted">
              The requirements, the gaps and the latest recovery decision, read from Datum&apos;s
              own records.
            </span>
          </span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={22}
            strokeWidth={1.6}
            className={cx(
              "mt-1 shrink-0 text-muted transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </h2>
      {open && (
        <div id="why-body" className="border-t border-line px-5 py-7 sm:px-6">
          <WhyContent resource={goal} />
        </div>
      )}
    </section>
  );
}
