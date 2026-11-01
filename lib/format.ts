import type { OrderStatus, Source } from "./shoplink";

/** 249000 → "249 000 сум" */
export const formatPrice = (n: number) => `${n.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} сум`;

// Pass `locale` from useT() so dates follow the chosen language.
export const formatDate = (iso: string, locale = "en-GB") =>
  new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

export const formatDateTime = (iso: string, locale = "en-GB") =>
  new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 min ago", "yesterday", "2 weeks ago" in the chosen language; under a minute it's "now". */
export function timeAgo(iso: string, locale = "en-GB", now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  for (const [unit, size] of UNITS) if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  return format.format(0, "second");
}

// English labels; show them through t() so they get translated.
export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** What an admin may change an order to (same rules as the backend). */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const SOURCE_LABELS: Record<Source, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  telegram: "Telegram",
  other: "Other",
};

/** Turns a backend error like "address must not be empty" into "Address must not be empty". */
export const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
