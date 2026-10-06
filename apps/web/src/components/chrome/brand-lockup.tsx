import { BrandMark } from "@/components/brand-mark";

export function BrandLockup() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark height={23} />
      <span aria-hidden className="font-display text-xl font-semibold tracking-[-0.06em] text-ink">
        datum
      </span>
    </span>
  );
}
