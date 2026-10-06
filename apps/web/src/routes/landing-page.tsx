import { ControlSection } from "@/components/landing/control-section";
import { Hero } from "@/components/landing/hero";
import { HeroShowcase } from "@/components/landing/hero-showcase";
import { HowItWorks } from "@/components/landing/how-it-works";
import { PaidTaskProof } from "@/components/landing/paid-task-proof";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { useDocumentTitle } from "@/lib/use-document-title";

export function LandingPage() {
  useDocumentTitle(null);
  return (
    <div className="relative isolate min-h-dvh overflow-x-clip pt-28 sm:pt-32">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div
        aria-hidden
        className="page-grid pointer-events-none absolute inset-0 -z-10 mx-auto max-w-7xl border-x border-line/40"
      />
      <div
        aria-hidden
        className="landing-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] overflow-hidden"
      >
        <div className="hero-orbit" />
      </div>
      <SiteNav />
      <main id="main-content">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Hero />
          <HeroShowcase />
          <HowItWorks />
        </div>
        <ControlSection />
        <div id="proof" className="mx-auto max-w-7xl px-5 sm:px-8">
          <PaidTaskProof />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
