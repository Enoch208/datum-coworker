import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { BrandMark } from "@/components/brand-mark";

export function RunnerShell() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <meta name="referrer" content="no-referrer" />
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-xl items-center justify-between gap-4 px-4">
          <BrandMark height={22} />
          <span className="text-sm text-muted">Runner tasks</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-6 pb-20">
        <Outlet />
      </main>
    </div>
  );
}
