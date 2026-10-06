import { Field, controlBorder, controlClass, describedBy } from "./field";
import { FormSection } from "./form-section";
import { withScheme } from "./form-values";
import type { SectionProps } from "./section-props";

export function BrandSection({ values, errors, onText }: SectionProps) {
  const nameError = errors.fields.brandName;
  const urlError = errors.fields.brandUrl;
  return (
    <FormSection index="01" title="Brand" description="Who the campaign is for.">
      <Field id="brand-name" label="Brand name" error={nameError}>
        <input
          id="brand-name"
          name="brandName"
          autoComplete="organization"
          value={values.brandName}
          onChange={(event) => {
            onText("brandName", event.target.value);
          }}
          aria-invalid={nameError !== undefined}
          aria-describedby={describedBy("brand-name", nameError, false)}
          className={`${controlClass} ${controlBorder(nameError)} h-11`}
        />
      </Field>
      <Field id="brand-url" label="Brand website" optional error={urlError}>
        <input
          id="brand-url"
          name="brandUrl"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://"
          value={values.brandUrl}
          onChange={(event) => {
            onText("brandUrl", event.target.value);
          }}
          onBlur={() => {
            onText("brandUrl", withScheme(values.brandUrl));
          }}
          aria-invalid={urlError !== undefined}
          aria-describedby={describedBy("brand-url", urlError, false)}
          className={`${controlClass} ${controlBorder(urlError)} h-11 font-mono text-sm`}
        />
      </Field>
    </FormSection>
  );
}
