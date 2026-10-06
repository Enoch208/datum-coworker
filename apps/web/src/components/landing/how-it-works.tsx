import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  PrinterIcon,
  Location01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "react-router";
import { primaryButton } from "@/components/feedback/buttons";
import { appRoutes } from "@/lib/routes";
import { CroppedPhoto } from "./cropped-photo";
import { crops } from "./landing-photos";

const steps = [
  {
    number: "01",
    title: "Tell us what goes where.",
    text: "Add your message, the places you have permission to use, a deadline and a spending limit.",
    crop: crops.counterCard,
    icon: Location01Icon,
    label: "You set the brief",
  },
  {
    number: "02",
    title: "Review it. Approve it.",
    text: "See the proposed copy, a QR card for every spot and the estimated cost before work starts.",
    crop: crops.cardInHand,
    icon: PrinterIcon,
    label: "You approve the plan",
  },
  {
    number: "03",
    title: "We handle the follow-through.",
    text: "Datum coordinates a runner, checks each photo and arranges another attempt if a spot is missed and your limits allow it.",
    crop: crops.phoneScreen,
    icon: CheckmarkCircle02Icon,
    label: "Datum manages the work",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="pb-24 sm:pb-32">
      <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow mb-4 text-muted">From your desk to the real world</p>
          <h2
            id="how-heading"
            className="text-3xl font-medium tracking-tight text-balance sm:text-5xl"
          >
            One brief. A campaign in motion.
          </h2>
          <p className="mt-4 max-w-xl text-base font-light text-muted">
            No chasing a printer, coordinating every task or asking where the photos went.
          </p>
        </div>
        <Link to={appRoutes.newCampaign} className={`${primaryButton} self-start sm:self-auto`}>
          Start with your brief <HugeiconsIcon icon={ArrowRight01Icon} size={16} aria-hidden />
        </Link>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((step) => (
          <article key={step.number} className="photo-card">
            <CroppedPhoto crop={step.crop} frameAspect={4 / 3} alt="" className="opacity-80">
              <span className="absolute top-4 left-4 rounded-full border border-ink/15 bg-canvas/70 px-3 py-1.5 font-mono text-xs text-ink backdrop-blur-md">
                {step.number}
              </span>
            </CroppedPhoto>
            <div className="p-6">
              <div className="mb-4 flex items-center gap-2 text-muted">
                <HugeiconsIcon icon={step.icon} size={16} aria-hidden />
                <span className="eyebrow">{step.label}</span>
              </div>
              <h3 className="text-xl font-medium tracking-tight text-balance">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{step.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
