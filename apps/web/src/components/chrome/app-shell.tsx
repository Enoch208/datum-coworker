import {
  ArrowLeft01Icon,
  Add01Icon,
  DashboardSquare01Icon,
  Certificate01Icon,
  Shield01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ReactNode, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { BrandLockup } from "./brand-lockup";
import { secondaryButton } from "@/components/feedback/buttons";
import { appRoutes, campaignHref, receiptHref } from "@/lib/routes";

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const campaignId = /^\/campaigns\/([^/]+)/.exec(pathname)?.[1];
  const currentId = campaignId === "new" ? undefined : campaignId;
  const title = currentId === undefined ? "Create a campaign" : "Your campaign";
  const items = [
    { label: "New campaign", short: "New", href: appRoutes.newCampaign, icon: Add01Icon },
    ...(currentId === undefined
      ? []
      : [
          {
            label: "Campaign overview",
            short: "Overview",
            href: campaignHref(currentId),
            icon: DashboardSquare01Icon,
          },
          {
            label: "Campaign receipt",
            short: "Receipt",
            href: receiptHref(currentId),
            icon: Certificate01Icon,
          },
        ]),
  ];

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-dvh p-2 sm:p-4 lg:p-6 print:p-0">
      <a href="#workspace-content" className="skip-link print:hidden">
        Skip to content
      </a>
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-[1500px] overflow-clip rounded-[24px] border border-line bg-surface shadow-2xl lg:rounded-[36px] print:block print:min-h-0 print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-line px-5 py-8 lg:flex xl:w-64 print:hidden">
          <Link to={appRoutes.landing} aria-label="Datum home" className="mb-12 px-3">
            <BrandLockup />
          </Link>
          <p className="eyebrow mb-4 px-3 text-muted">Your workspace</p>
          <nav aria-label="Workspace navigation" className="flex flex-col gap-2">
            {items.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${pathname === item.href ? "bg-ink/5 text-ink" : "text-muted hover:bg-raised hover:text-ink"}`}
              >
                <HugeiconsIcon
                  icon={item.icon}
                  size={18}
                  className={pathname === item.href ? "text-accent" : ""}
                  aria-hidden
                />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-10 rounded-2xl border border-line p-4">
            <HugeiconsIcon icon={Shield01Icon} size={20} className="text-accent" aria-hidden />
            <p className="mt-3 text-sm text-ink">You stay in control.</p>
            <p className="mt-2 text-xs text-muted">
              Review the plan and costs before approving. Datum asks before exceeding your budget.
            </p>
          </div>
          <div className="mt-auto border-t border-line pt-6">
            <Link
              to={appRoutes.landing}
              className="flex min-h-11 items-center gap-3 px-3 text-sm text-muted hover:text-ink"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={16} aria-hidden />
              Back to site
            </Link>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8 lg:py-7 print:hidden">
            <Link to={appRoutes.landing} aria-label="Datum home" className="lg:hidden">
              <BrandLockup />
            </Link>
            <span className="hidden font-display text-2xl font-medium tracking-tight lg:block">
              {title}
            </span>
            <div className="hidden items-center rounded-full border border-line bg-raised/60 p-1 text-xs sm:flex">
              <span className="rounded-full bg-ink/10 px-4 py-2 text-ink">Workspace</span>
              <Link to={appRoutes.landing} className="px-4 py-2 text-muted hover:text-ink">
                Site
              </Link>
            </div>
            <span className="eyebrow text-muted sm:hidden">Workspace</span>
            {currentId !== undefined && (
              <Link to={appRoutes.newCampaign} className={`${secondaryButton} max-sm:hidden`}>
                <HugeiconsIcon icon={Add01Icon} size={16} aria-hidden />
                New campaign
              </Link>
            )}
          </header>
          {items.length > 1 && (
            <nav
              aria-label="Mobile workspace navigation"
              className="flex gap-2 overflow-x-auto border-y border-line px-4 py-3 lg:hidden print:hidden"
            >
              {items.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-xs font-medium ${pathname === item.href ? "bg-ink text-canvas" : "bg-raised text-muted"}`}
                >
                  {item.short}
                </Link>
              ))}
            </nav>
          )}
          <main
            id="workspace-content"
            className="min-w-0 border-t border-line px-4 pt-7 pb-16 sm:px-8 lg:pt-8 xl:px-10 print:border-0 print:p-0"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
