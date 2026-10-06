import type { CampaignFormErrors, CampaignFormValues, TextField } from "./form-values";

export interface SectionProps {
  readonly values: CampaignFormValues;
  readonly errors: CampaignFormErrors;
  readonly onText: (field: TextField, value: string) => void;
}
