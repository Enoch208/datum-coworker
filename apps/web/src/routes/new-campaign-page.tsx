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
        <h1 className="mt-5 text-4xl font-light tracking-tight sm:text-6xl">Create a campaign</h1>
        <p className="mt-5 text-lg font-light text-muted">
          Tell Datum what to promote, where it may go, when it must be live and the most it may
          spend. You get a proposal with a card for every spot to review before anything happens.
        </p>
      </header>
      <div className="mt-12 sm:mt-16">
        <CampaignForm phase={phase} serverError={serverError} onSubmit={submit} />
      </div>
    </>
  );
}
