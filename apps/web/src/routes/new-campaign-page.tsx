import { useState } from "react";
import { useNavigate } from "react-router";
import { CampaignForm } from "@/components/campaign-form/campaign-form";
import type { SubmitPhase } from "@/components/campaign-form/brief-panel";
import { toCreateRequest, type CampaignFormValues } from "@/components/campaign-form/form-values";
import { createCampaign, requestPlan } from "@/lib/api-client";
import type { PlanHandoff } from "@/lib/plan-handoff";
import { campaignHref } from "@/lib/routes";
import { useDocumentTitle } from "@/lib/use-document-title";

const asError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

export function NewCampaignPage() {
  useDocumentTitle("Create campaign");
  const navigate = useNavigate();
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [serverError, setServerError] = useState<Error | null>(null);

  const open = (campaignId: string, handoff: PlanHandoff | null) => {
    void navigate(campaignHref(campaignId), { state: handoff });
  };

  const submit = (values: CampaignFormValues) => {
    setPhase("creating");
    setServerError(null);
    void createCampaign(toCreateRequest(values)).then(
      (campaignId) => {
        setPhase("planning");
        void requestPlan(campaignId).then(
          () => {
            open(campaignId, null);
          },
          (cause: unknown) => {
            open(campaignId, { planFailure: asError(cause).message });
          },
        );
      },
      (cause: unknown) => {
        setPhase("idle");
        setServerError(asError(cause));
      },
    );
  };

  return (
    <>
      <header className="max-w-2xl">
        <p className="font-mono text-xs tracking-[0.2em] text-muted uppercase">New campaign</p>
        <h1 className="mt-5 text-3xl font-medium tracking-tight sm:text-4xl">
          What do you want to promote?
        </h1>
        <p className="mt-4 max-w-xl text-sm text-muted">
          A few details are all Datum needs to draft your cards and plan. You’ll review everything
          before approving any work.
        </p>
      </header>
      <div className="mt-8">
        <CampaignForm phase={phase} serverError={serverError} onSubmit={submit} />
      </div>
    </>
  );
}
