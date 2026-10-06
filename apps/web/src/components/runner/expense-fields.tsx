import { Camera01Icon } from "@hugeicons/core-free-icons";
import { FieldError, controlBorder, controlClass } from "@/components/campaign-form/field";
import { PhotoButton } from "./step-buttons";
import type { ChosenPhoto } from "./use-chosen-photo";

const fieldLabel = "text-[15px] font-medium text-ink";

export function ReceiptPhoto({
  chosen,
  error,
  disabled,
  onChosen,
}: {
  chosen: ChosenPhoto | null;
  error: string | undefined;
  disabled: boolean;
  onChosen: (file: File) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className={fieldLabel}>Receipt photo</p>
      {chosen !== null && (
        <img
          src={chosen.previewUrl}
          alt="The receipt you are about to send"
          className="max-h-[40vh] w-full rounded-xl border border-line bg-raised object-contain"
        />
      )}
      <PhotoButton
        id="receipt-photo"
        label={chosen === null ? "Take receipt photo" : "Retake receipt photo"}
        icon={Camera01Icon}
        primary={false}
        disabled={disabled}
        onChosen={onChosen}
      />
      <FieldError id="receipt-photo" error={error} />
    </div>
  );
}

export function AmountField({
  value,
  error,
  disabled,
  onChange,
}: {
  value: string;
  error: string | undefined;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="paid-amount" className={fieldLabel}>
        Amount you actually paid
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-mono text-[17px] text-muted">
          SGD
        </span>
        <input
          id="paid-amount"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          aria-invalid={error !== undefined}
          aria-describedby={error === undefined ? "paid-amount-hint" : "paid-amount-error"}
          className={`${controlClass} ${controlBorder(error)} h-14 pl-16 font-mono text-xl tabular-nums`}
        />
      </div>
      <p id="paid-amount-hint" className="text-sm text-muted">
        The total printed on the receipt, not the estimate.
      </p>
      <FieldError id="paid-amount" error={error} />
    </div>
  );
}

export function MerchantField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="merchant" className={fieldLabel}>
        Shop name <span className="font-normal text-muted">Optional</span>
      </label>
      <input
        id="merchant"
        name="merchant"
        autoComplete="organization"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={`${controlClass} border-line-strong h-14 text-[17px]`}
      />
    </div>
  );
}
