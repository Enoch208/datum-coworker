import { formatMoney, fromWireMoney, type WireMoney } from "@datum/core";

export const singaporeZone = "Asia/Singapore";

const sgtFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: singaporeZone,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const sgtTimeFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: singaporeZone,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function formatWireMoney(money: WireMoney): string {
  return formatMoney(fromWireMoney(money));
}

export function formatSgt(iso: string): string {
  return `${sgtFormat.format(new Date(iso))} SGT`;
}

export function formatSgtMoment(iso: string): string {
  return sgtTimeFormat.format(new Date(iso));
}

export function shortHash(hash: string): string {
  const bare = hash.replace(/^sha256:/, "");
  return bare.length > 12 ? `${bare.slice(0, 12)}…` : bare;
}

const sgtShortFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: singaporeZone,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatSgtShort(iso: string): string {
  return `${sgtShortFormat.format(new Date(iso))} SGT`;
}
