import { type ReactNode, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { BrandMark } from "@/components/brand-mark";
import { secondaryButton } from "@/components/feedback/buttons";
import { appRoutes } from "@/lib/routes";

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link to={appRoutes.landing} aria-label="Datum home" className="rounded-md">
            <BrandMark height={24} />
          </Link>
          {pathname !== appRoutes.newCampaign && (
            <Link to={appRoutes.newCampaign} className={secondaryButton}>
              New campaign
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-24 sm:px-8 sm:pt-16">
        {children}
      </main>
    </div>
  );
}
