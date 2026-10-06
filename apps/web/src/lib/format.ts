import { formatMoney, fromWireMoney, parseMoney, type Money, type WireMoney } from "@datum/core";

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

const sgtShortFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: singaporeZone,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const sgtClockFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: singaporeZone,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const sgtHourFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: singaporeZone,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function toMoney(wire: WireMoney): Money {
  if (!wire.amount.startsWith("-")) return fromWireMoney(wire);
  const magnitude = parseMoney(wire.amount.slice(1), wire.currency);
  return { amountMinor: -magnitude.amountMinor, currency: wire.currency };
}

export function formatWireMoney(money: WireMoney): string {
  return formatMoney(toMoney(money));
}

export function formatSgt(iso: string): string {
  return `${sgtFormat.format(new Date(iso))} SGT`;
}

export function formatSgtMoment(iso: string): string {
  return sgtTimeFormat.format(new Date(iso));
}

export function sgtDayTime(iso: string): string {
  return sgtShortFormat.format(new Date(iso));
}

export function formatSgtShort(iso: string): string {
  return `${sgtDayTime(iso)} SGT`;
}

export function formatSgtClock(iso: string | number): string {
  return `${sgtClockFormat.format(new Date(iso))} SGT`;
}

export function formatSgtHour(iso: string): string {
  return `${sgtHourFormat.format(new Date(iso))} SGT`;
}

export function shortHash(hash: string): string {
  const bare = hash.replace(/^sha256:/, "");
  return bare.length > 12 ? `${bare.slice(0, 12)}…` : bare;
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${String(rest)} min`;
  return rest === 0 ? `${String(hours)} h` : `${String(hours)} h ${String(rest)} min`;
}

export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${String(count)} ${count === 1 ? one : many}`;

export const spotList = (codes: readonly string[]): string => {
  if (codes.length <= 1) return `Spot ${codes[0] ?? ""}`;
  return `Spots ${codes.slice(0, -1).join(", ")} and ${codes.at(-1) ?? ""}`;
};
