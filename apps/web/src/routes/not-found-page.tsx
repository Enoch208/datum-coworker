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
      <p className="eyebrow text-muted">Error 404</p>
      <h1 className="mt-4 text-4xl font-medium tracking-tight text-balance sm:text-5xl">
        This page does not exist.
      </h1>
      <p className="mt-5 text-lg font-light text-pretty text-muted">
        The address may be mistyped, or the link may point to something that was never created.
      </p>
      <Link to={appRoutes.landing} className={`${secondaryButton} mt-10`}>
        <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={1.8} aria-hidden />
        Back to Datum
      </Link>
    </section>
  );
}
