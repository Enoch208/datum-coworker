import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "react-router";
import { primaryButton } from "@/components/feedback/buttons";
import { appRoutes } from "@/lib/routes";

const stages = [
  { number: "01", title: "Set the goal", detail: "Your message, spots & limits" },
  { number: "02", title: "Approve once", detail: "Review the cards & plan" },
  { number: "03", title: "Go back to work", detail: "Datum coordinates & checks" },
  { number: "04", title: "Keep the proof", detail: "Photos, spend & a receipt" },
];

export function Hero() {
  return (
    <section
      aria-labelledby="landing-heading"
      className="relative mx-auto mb-16 max-w-5xl pt-14 text-center sm:mb-24 sm:pt-12"
    >
      <p className="rise mb-8 inline-flex items-center rounded-full border border-line-strong bg-raised/60 px-3 py-1 text-[10px] font-medium tracking-wider text-muted uppercase [animation-delay:100ms]">
        Your AI field marketing coworker
      </p>
      <h1
        id="landing-heading"
        className="rise text-[clamp(2.5rem,5.6vw,4rem)] leading-[1.05] font-medium tracking-tight text-balance text-ink [animation-delay:200ms]"
      >
        You set the goal.{" "}
        <span className="text-gradient-grey pb-[0.12em] sm:-mb-[0.12em] sm:block">
          Datum gets the campaign live.
        </span>
      </h1>
      <p className="rise mx-auto mt-7 max-w-2xl text-base leading-relaxed font-light tracking-tight text-pretty text-muted [animation-delay:300ms] sm:text-lg">
        Give Datum the message, the approved spots, a deadline and a budget. Approve once, and it
        handles printing, placement and proof until every spot is live.
      </p>
      <div className="rise mt-9 flex flex-col items-center gap-4 [animation-delay:400ms]">
        <Link to={appRoutes.newCampaign} className={`${primaryButton} px-8`}>
          Create your campaign <HugeiconsIcon icon={ArrowRight01Icon} size={17} aria-hidden />
        </Link>
        <a
          href="#how-it-works"
          className="inline-flex min-h-11 items-center gap-2 text-xs text-muted hover:text-ink"
        >
          See how it works <span aria-hidden>↓</span>
        </a>
      </div>
      <ol
        aria-label="Your campaign journey"
        className="rise relative mt-12 grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-canvas/80 text-left backdrop-blur-sm [animation-delay:500ms] sm:mt-16 md:grid-cols-4"
      >
        {stages.map((stage, index) => (
          <li
            key={stage.number}
            className={`p-5 sm:p-6 ${index > 1 ? "border-t md:border-t-0" : ""} ${index % 2 !== 0 ? "border-l" : "md:border-l"} ${index === 0 ? "md:border-l-0" : ""} border-line`}
          >
            <span className="font-mono text-[11px] text-muted tabular-nums">{stage.number}</span>
            <p className="mt-2 text-sm font-medium text-ink">{stage.title}</p>
            <p className="mt-1 text-xs text-muted">{stage.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
