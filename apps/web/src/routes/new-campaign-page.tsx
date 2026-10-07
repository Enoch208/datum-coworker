import { useState } from "react";
import { useNavigate } from "react-router";
import { CampaignForm } from "@/components/campaign-form/campaign-form";
import type { SubmitPhase } from "@/components/campaign-form/brief-panel";
import { toCreateRequest, type CampaignFormValues } from "@/components/campaign-form/form-values";
import { createCampaign, requestPlan } from "@/lib/api-client";
import { newOwnerKey, ownerLinkHash, rememberOwner } from "@/lib/owner-key";
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

  const submit = (values: CampaignFormValues) => {
    setPhase("creating");
    setServerError(null);
    void newOwnerKey()
      .then(async (owner) => {
        const campaignId = await createCampaign({
          ...toCreateRequest(values),
          ownerKey: owner.publicKey,
        });
        rememberOwner(campaignId, owner);
        return { campaignId, link: ownerLinkHash(owner.privateKey) };
      })
      .then(
        ({ campaignId, link }) => {
          const open = (handoff: PlanHandoff | null) => {
            void navigate(`${campaignHref(campaignId)}${link}`, { state: handoff });
          };
          setPhase("planning");
          void requestPlan(campaignId).then(
            () => {
              open(null);
            },
            (cause: unknown) => {
              open({ planFailure: asError(cause).message });
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
        <p className="eyebrow text-muted">New campaign</p>
        <h1 className="mt-4 text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          What do you want to promote?
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-pretty text-muted">
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
