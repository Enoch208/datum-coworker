import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { BrandLockup } from "@/components/chrome/brand-lockup";

export function RunnerShell() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col overflow-x-clip bg-surface sm:my-6 sm:min-h-[calc(100dvh-3rem)] sm:rounded-3xl sm:border sm:border-line">
      <meta name="referrer" content="no-referrer" />
      <header className="border-b border-line">
        <div className="mx-auto flex h-20 w-full max-w-xl items-center justify-between gap-4 px-4">
          <BrandLockup />
          <span className="rounded-full border border-line bg-raised px-3 py-2 text-xs text-muted">
            Runner tasks
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-6 pb-20">
        <Outlet />
      </main>
    </div>
  );
}
