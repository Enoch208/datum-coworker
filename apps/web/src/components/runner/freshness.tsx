import { Refresh01Icon, WifiOff01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cx } from "@/lib/cx";
import { useNow } from "@/lib/use-now";

function ageText(seconds: number): string {
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${String(seconds)} s ago`;
  return `${String(Math.floor(seconds / 60))} min ago`;
}

export function Freshness({ updatedAt, failing }: { updatedAt: number | null; failing: boolean }) {
  const now = useNow(1000);
  if (updatedAt === null) return null;
  const age = ageText(Math.max(0, Math.round((now - updatedAt) / 1000)));
  return (
    <p className={cx("flex items-center gap-2 text-sm", failing ? "text-warn" : "text-muted")}>
      <HugeiconsIcon
        icon={failing ? WifiOff01Icon : Refresh01Icon}
        size={16}
        strokeWidth={1.8}
        aria-hidden
      />
      {failing ? `No connection to Datum. Last updated ${age}.` : `Updated ${age}`}
    </p>
  );
}
