import { SentIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ExpenseView, RunnerTaskView } from "@datum/core";
import { useCallback, useState } from "react";
import { touchPrimary, touchSecondary } from "@/components/feedback/buttons";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { formatWireMoney } from "@/lib/format";
import { submitExpense } from "@/lib/runner-client";
import { AmountField, MerchantField, ReceiptPhoto } from "./expense-fields";
import { ExpenseRecord } from "./expense-record";
import { readPaidAmount } from "./paid-amount";
import { SendProgress } from "./step-buttons";
import { StepFrame, StepText } from "./step-frame";
import { useChosenPhoto } from "./use-chosen-photo";
import { useUpload } from "./use-upload";

interface FormErrors {
  readonly receipt?: string;
  readonly amount?: string;
}

function ExpenseForm({
  token,
  task,
  onSubmitted,
}: {
  token: string;
  task: RunnerTaskView;
  onSubmitted: (expense: ExpenseView) => void;
}) {
  const { chosen, choose } = useChosenPhoto();
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const finished = useCallback(
    (expense: ExpenseView) => {
      choose(null);
      onSubmitted(expense);
    },
    [choose, onSubmitted],
  );
  const upload = useUpload(finished);
  const sending = upload.state.kind === "sending";

  const submit = () => {
    const paid = readPaidAmount(amount);
    setErrors({
      ...(chosen === null ? { receipt: "Take a photo of the receipt first." } : {}),
      ...(paid.ok ? {} : { amount: paid.error }),
    });
    if (chosen === null || !paid.ok) return;
    const submission = { receipt: chosen.file, amount: paid.amount, merchant: merchant.trim() };
    upload.start((onProgress) => submitExpense(token, task.id, submission, onProgress));
  };

  return (
    <StepFrame title="Send the print receipt">
      <StepText>
        Enter exactly what you paid. Datum planned about{" "}
        <span className="font-mono text-ink">{formatWireMoney(task.estimatedCost)}</span>, but only
        the amount on your receipt counts.
      </StepText>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex flex-col gap-6"
      >
        <ReceiptPhoto
          chosen={chosen}
          error={errors.receipt}
          disabled={sending}
          onChosen={(file) => {
            upload.reset();
            choose(file);
            setErrors(({ amount: amountError }) =>
              amountError === undefined ? {} : { amount: amountError },
            );
          }}
        />
        <AmountField
          value={amount}
          error={errors.amount}
          disabled={sending}
          onChange={(value) => {
            setAmount(value);
            setErrors(({ receipt }) => (receipt === undefined ? {} : { receipt }));
          }}
        />
        <MerchantField value={merchant} disabled={sending} onChange={setMerchant} />
        {upload.state.kind === "sending" && (
          <SendProgress fraction={upload.state.fraction} what="receipt" />
        )}
        {upload.state.kind === "failed" && (
          <ErrorPanel title="The receipt was not sent" message={upload.state.message} />
        )}
        <button type="submit" disabled={sending} className={touchPrimary}>
          <HugeiconsIcon icon={SentIcon} size={20} strokeWidth={1.8} aria-hidden />
          {upload.state.kind === "failed" ? "Send again" : "Send receipt"}
        </button>
      </form>
    </StepFrame>
  );
}

export function ExpenseStep({
  token,
  task,
  shown,
  onSubmitted,
}: {
  token: string;
  task: RunnerTaskView;
  shown: ExpenseView | null;
  onSubmitted: (expense: ExpenseView) => void;
}) {
  const [again, setAgain] = useState(false);
  const submitted = useCallback(
    (expense: ExpenseView) => {
      setAgain(false);
      onSubmitted(expense);
    },
    [onSubmitted],
  );
  if (shown === null || again) {
    return <ExpenseForm token={token} task={task} onSubmitted={submitted} />;
  }
  return (
    <StepFrame title="Your receipt">
      <ExpenseRecord expense={shown} />
      {shown.status === "DISPUTED" && (
        <button
          type="button"
          onClick={() => {
            setAgain(true);
          }}
          className={touchSecondary}
        >
          Send the receipt again
        </button>
      )}
    </StepFrame>
  );
}
