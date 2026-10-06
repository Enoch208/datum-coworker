import { ArrowUpRight01Icon, Menu01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Link } from "react-router";
import { BrandLockup } from "@/components/chrome/brand-lockup";
import { appRoutes } from "@/lib/routes";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#your-control", label: "Your control" },
  { href: "#proof", label: "Payment proof" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4 sm:top-6 sm:px-6">
      <nav
        aria-label="Main navigation"
        className="mx-auto max-w-5xl rounded-[28px] border border-line bg-canvas/85 p-2 shadow-2xl ring-1 ring-ink/5 backdrop-blur-xl"
      >
        <div className="flex min-h-11 items-center justify-between gap-3 pl-3 sm:pl-4">
          <Link to={appRoutes.landing} aria-label="Datum home">
            <BrandLockup />
          </Link>
          <div className="hidden items-center gap-7 md:flex">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="py-3 text-xs text-muted transition-colors hover:text-ink"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Link
              to={appRoutes.newCampaign}
              aria-label="Start a campaign"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-raised px-4 text-xs font-medium text-ink hover:bg-line"
            >
              <span className="sm:hidden">Start</span>
              <span className="hidden sm:inline">Start a campaign</span>
              <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} aria-hidden />
            </Link>
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-site-menu"
              onClick={() => {
                setOpen(!open);
              }}
              className="flex size-11 items-center justify-center rounded-full text-muted hover:text-ink md:hidden"
            >
              <HugeiconsIcon icon={open ? Cancel01Icon : Menu01Icon} size={20} aria-hidden />
            </button>
          </div>
        </div>
        {open && (
          <div id="mobile-site-menu" className="mt-2 grid border-t border-line px-3 py-3 md:hidden">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => {
                  setOpen(false);
                }}
                className="rounded-xl px-3 py-3 text-sm text-muted hover:bg-raised hover:text-ink"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
}
