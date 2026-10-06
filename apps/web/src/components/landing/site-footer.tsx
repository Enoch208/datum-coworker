import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "react-router";
import { BrandLockup } from "@/components/chrome/brand-lockup";
import { primaryButton } from "@/components/feedback/buttons";
import { appRoutes } from "@/lib/routes";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="landing-glow px-5 py-24 text-center sm:py-32">
        <h2 className="text-3xl font-medium tracking-tight text-balance sm:text-5xl">
          Give the campaign a goal.
          <br />
          <span className="text-gradient-grey">Get back to yours.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-md text-sm text-balance text-muted">
          Start with a brief. Review the plan before anything is printed, placed or spent.
        </p>
        <Link to={appRoutes.newCampaign} className={`${primaryButton} mt-8`}>
          Create your campaign <HugeiconsIcon icon={ArrowRight01Icon} size={17} aria-hidden />
        </Link>
      </div>
      <div className="mx-auto max-w-7xl px-5 pb-10 sm:px-8">
        <div className="flex flex-col justify-between gap-9 border-t border-line pt-10 sm:flex-row">
          <div className="max-w-xs">
            <Link to={appRoutes.landing} aria-label="Datum home">
              <BrandLockup />
            </Link>
            <p className="mt-4 text-xs text-muted">
              Your AI coworker for printing, placing and checking small physical marketing
              campaigns.
            </p>
          </div>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap content-start gap-x-8 gap-y-3 text-xs text-muted"
          >
            <a className="py-3 hover:text-ink" href="#how-it-works">
              How it works
            </a>
            <a className="py-3 hover:text-ink" href="#your-control">
              Your control
            </a>
            <a className="py-3 hover:text-ink" href="#proof">
              Payment proof
            </a>
            <a
              className="py-3 hover:text-ink"
              href="https://github.com/Enoch208/datum-coworker"
              target="_blank"
              rel="noreferrer"
            >
              GitHub ↗
            </a>
          </nav>
        </div>
        <div className="mt-10 flex flex-col justify-between gap-3 border-t border-line pt-6 text-xs text-muted sm:flex-row">
          <span>© 2026 Datum</span>
          <span>Local enrolled runners · Masumi payments on Cardano Preprod</span>
        </div>
      </div>
    </footer>
  );
}
