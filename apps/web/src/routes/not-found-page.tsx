import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "react-router";
import { secondaryButton } from "@/components/feedback/buttons";
import { appRoutes } from "@/lib/routes";
import { useDocumentTitle } from "@/lib/use-document-title";

export function NotFoundPage() {
  useDocumentTitle("Page not found");

  return (
    <section className="flex max-w-xl flex-col items-start">
      <p className="font-mono text-xs tracking-[0.2em] text-muted uppercase">404</p>
      <h1 className="mt-5 text-4xl font-light tracking-tight sm:text-5xl">
        This page does not exist.
      </h1>
      <p className="mt-5 text-lg font-light text-muted">
        The address may be mistyped, or the link may point to something that was never created.
      </p>
      <Link to={appRoutes.landing} className={`${secondaryButton} mt-10`}>
        <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={1.8} aria-hidden />
        Back to Datum
      </Link>
    </section>
  );
}
