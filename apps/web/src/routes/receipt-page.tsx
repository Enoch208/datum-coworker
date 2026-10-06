import { ArrowLeft01Icon, PrinterIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CampaignReceiptView } from "@datum/core";
import { useCallback, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { BrandLockup } from "@/components/chrome/brand-lockup";
import { quietButton, secondaryButton } from "@/components/feedback/buttons";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { CoworkerPayment } from "@/components/receipt/coworker-payment";
import { ReceiptCard } from "@/components/receipt/receipt-card";
import { ReceiptRecoveries } from "@/components/receipt/receipt-recoveries";
import { ReceiptSeal } from "@/components/receipt/receipt-seal";
import { ReceiptSpend } from "@/components/receipt/receipt-spend";
import { ReceiptSpots } from "@/components/receipt/receipt-spots";
import { TargetActual } from "@/components/receipt/target-actual";
import { getReceipt } from "@/lib/api-client";
import { ApiRequestError } from "@/lib/http";
import { appRoutes, campaignHref } from "@/lib/routes";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useResource } from "@/lib/use-resource";

function Frame({ campaignId, children }: { campaignId: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh overflow-x-clip px-4 pt-6 pb-20 sm:px-8 sm:pt-8 print:p-0">
      <a href="#receipt-content" className="skip-link print:hidden">
        Skip to content
      </a>
      <div className="mx-auto w-full max-w-[1200px]">
        <nav
          aria-label="Receipt navigation"
          className="mb-8 flex items-center justify-between gap-4 print:hidden"
        >
          <Link to={appRoutes.landing} aria-label="Datum home" className="rounded-md">
            <BrandLockup />
          </Link>
          <Link to={campaignHref(campaignId)} className={quietButton}>
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={1.8} aria-hidden />
            Live campaign
          </Link>
        </nav>
        <main id="receipt-content">{children}</main>
      </div>
    </div>
  );
}

function Waiting({ campaignId, error }: { campaignId: string; error: ApiRequestError }) {
  const message = error.message.replace(/\.$/, "");
  return (
    <section className="max-w-xl">
      <h1 className="text-4xl font-medium tracking-tight">
        {error.code === "NO_RECEIPT" ? "No receipt yet" : "No campaign here"}
      </h1>
      <p className="mt-4 text-lg font-light text-muted">{message}.</p>
      <Link to={campaignHref(campaignId)} className={`${secondaryButton} mt-8`}>
        Follow the live campaign
      </Link>
    </section>
  );
}

function Receipt({ receipt }: { receipt: CampaignReceiptView }) {
  return (
    <div className="flex flex-col gap-6">
      <ReceiptCard receipt={receipt} />
      <div className="flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => {
            window.print();
          }}
          className={quietButton}
        >
          <HugeiconsIcon icon={PrinterIcon} size={16} strokeWidth={1.8} aria-hidden />
          Print or save as PDF
        </button>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <TargetActual receipt={receipt} />
          <ReceiptSpots receipt={receipt} />
        </div>
        <div className="flex flex-col gap-6">
          <ReceiptRecoveries receipt={receipt} />
          <ReceiptSpend receipt={receipt} />
          <CoworkerPayment proof={receipt.masumi} />
          <ReceiptSeal receipt={receipt} />
        </div>
      </div>
    </div>
  );
}

export function ReceiptPage() {
  const { campaignId = "" } = useParams();
  const load = useCallback((signal: AbortSignal) => getReceipt(campaignId, signal), [campaignId]);
  const receipt = useResource(`receipt:${campaignId}`, load);
  useDocumentTitle(
    receipt.data === null ? "Campaign Receipt" : `${receipt.data.campaignName} receipt`,
  );
  const { error } = receipt;
  if (error instanceof ApiRequestError && error.status === 404) {
    return (
      <Frame campaignId={campaignId}>
        <Waiting campaignId={campaignId} error={error} />
      </Frame>
    );
  }
  return (
    <Frame campaignId={campaignId}>
      {receipt.data !== null ? (
        <Receipt receipt={receipt.data} />
      ) : error !== null ? (
        <ErrorPanel
          title="The Campaign Receipt could not be loaded"
          message={error.message}
          onRetry={receipt.reload}
        />
      ) : (
        <div
          role="status"
          aria-busy="true"
          className="h-[630px] rounded-3xl bg-raised motion-safe:animate-pulse"
        >
          <span className="sr-only">Loading the Campaign Receipt…</span>
        </div>
      )}
    </Frame>
  );
}
