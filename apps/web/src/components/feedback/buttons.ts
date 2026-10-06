const buttonBase =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButton = `${buttonBase} min-h-12 bg-accent px-6 py-3 text-sm text-on-accent hover:bg-ink/85`;

export const secondaryButton = `${buttonBase} min-h-11 border border-line-strong bg-raised/50 px-4 py-2 text-sm text-ink hover:bg-raised`;

export const quietButton = `${buttonBase} min-h-11 px-3 py-2 text-sm text-muted hover:bg-raised hover:text-ink`;

export const touchPrimary = `${buttonBase} h-14 w-full bg-accent px-6 text-[17px] text-on-accent active:bg-ink/80`;

export const touchSecondary = `${buttonBase} h-14 w-full border border-line-strong px-6 text-[17px] text-ink active:bg-raised`;
