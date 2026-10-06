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
      <div className="mb-8 inline-flex items-center rounded-full border border-line-strong bg-raised/60 px-3 py-1.5 text-[10px] font-medium tracking-wider text-muted uppercase">
        Your AI field marketing coworker
      </div>
      <h1
        id="landing-heading"
        className="text-[clamp(2.65rem,6vw,4.5rem)] leading-[1.06] font-medium tracking-[-0.065em] text-balance text-ink"
      >
        Your campaign.
        <br />
        <span className="text-faint">Printed, placed, proven.</span>
      </h1>
      <p className="mx-auto mt-7 max-w-[550px] text-base font-light tracking-tight text-muted sm:text-lg">
        Your campaign. Out in the world. Give Datum your message, approved spots, deadline and
        budget. Approve the plan once. It handles the printing, placement and proof.
      </p>
      <div className="mt-9 flex flex-col items-center gap-4">
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
        className="relative mt-10 grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-canvas/80 text-left backdrop-blur-sm sm:mt-12 md:grid-cols-4"
      >
        {stages.map((stage, index) => (
          <li
            key={stage.number}
            className={`p-5 sm:p-6 ${index > 1 ? "border-t md:border-t-0" : ""} ${index % 2 !== 0 ? "border-l" : "md:border-l"} ${index === 0 ? "md:border-l-0" : ""} border-line`}
          >
            <span className="font-mono text-[10px] text-accent">{stage.number}</span>
            <p className="mt-2 text-sm font-medium text-ink">{stage.title}</p>
            <p className="mt-1 text-xs text-faint">{stage.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
