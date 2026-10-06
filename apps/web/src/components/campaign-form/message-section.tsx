import { cx } from "@/lib/cx";
import { Field, controlBorder, controlClass, describedBy } from "./field";
import { FormSection } from "./form-section";
import { messageLimit, withScheme } from "./form-values";
import type { SectionProps } from "./section-props";

function CharacterCount({ count }: { count: number }) {
  return (
    <span
      id="message-count"
      className={cx(
        "font-mono text-xs tabular-nums",
        count > messageLimit
          ? "text-danger"
          : count > messageLimit - 20
            ? "text-warn"
            : "text-muted",
      )}
    >
      {count} / {messageLimit}
    </span>
  );
}

export function MessageSection({ values, errors, onText }: SectionProps) {
  const messageError = errors.fields.message;
  const destinationError = errors.fields.destinationUrl;
  return (
    <FormSection
      index="02"
      title="Message"
      description="What people read on the card, and where its QR code takes them."
    >
      <Field
        id="message"
        label="Campaign message"
        hint="One line. Datum drafts the headline and subcopy from it for you to approve."
        error={messageError}
        aside={<CharacterCount count={values.message.length} />}
      >
        <textarea
          id="message"
          name="message"
          rows={3}
          value={values.message}
          onChange={(event) => {
            onText("message", event.target.value);
          }}
          aria-invalid={messageError !== undefined}
          aria-describedby={cx(describedBy("message", messageError, true), "message-count")}
          className={`${controlClass} ${controlBorder(messageError)} resize-y py-3 leading-relaxed`}
        />
      </Field>
      <Field
        id="destination-url"
        label="Where the QR code sends people"
        hint="Every spot gets its own QR code. Each scan is counted for its spot, then redirected here."
        error={destinationError}
      >
        <input
          id="destination-url"
          name="destinationUrl"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://"
          value={values.destinationUrl}
          onChange={(event) => {
            onText("destinationUrl", event.target.value);
          }}
          onBlur={() => {
            onText("destinationUrl", withScheme(values.destinationUrl));
          }}
          aria-invalid={destinationError !== undefined}
          aria-describedby={describedBy("destination-url", destinationError, true)}
          className={`${controlClass} ${controlBorder(destinationError)} h-11 font-mono text-sm`}
        />
      </Field>
    </FormSection>
  );
}
