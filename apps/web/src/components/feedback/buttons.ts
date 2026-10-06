const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButton = `${buttonBase} h-12 bg-accent px-6 text-[15px] text-on-accent hover:bg-ink`;

export const secondaryButton = `${buttonBase} h-10 border border-line-strong px-4 text-sm text-ink hover:bg-raised`;

export const quietButton = `${buttonBase} h-9 px-3 text-sm text-muted hover:bg-raised hover:text-ink`;

export const touchPrimary = `${buttonBase} h-14 w-full bg-accent px-6 text-[17px] text-on-accent active:bg-ink`;

export const touchSecondary = `${buttonBase} h-14 w-full border border-line-strong px-6 text-[17px] text-ink active:bg-raised`;
