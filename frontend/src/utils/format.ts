import type { Preferences } from "@/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function renderDate(y: number, m: number, d: number, format: string) {
  const dd = String(d).padStart(2, "0");
  const mm = String(m + 1).padStart(2, "0");
  if (format === "MM/DD/YYYY") return `${mm}/${dd}/${y}`;
  if (format === "DD/MM/YYYY") return `${dd}/${mm}/${y}`;
  if (format === "YYYY-MM-DD") return `${y}-${mm}-${dd}`;
  return `${dd} ${MONTHS[m]} ${y}`;
}

function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month") - 1, d: get("day") };
}

const safeZone = (zone: string | null | undefined, fallback: string) => {
  if (!zone) return fallback;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return zone;
  } catch {
    return fallback;
  }
};

export function makeFormatters(prefs: Preferences) {
  const time = (date: Date, zone: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: prefs.timeFormat === "12h",
    }).format(date);

  return {
    /** A calendar date such as a due date, stored as midnight UTC, shown without zone shifting. */
    day(iso: string | null | undefined) {
      if (!iso) return "";
      const date = new Date(iso);
      return renderDate(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        prefs.dateFormat,
      );
    },
    /** An instant's date in the company zone, or in a given zone such as the client's. */
    date(iso: string | null | undefined, zone?: string | null) {
      if (!iso) return "";
      const { y, m, d } = partsInZone(new Date(iso), safeZone(zone, prefs.timezone));
      return renderDate(y, m, d, prefs.dateFormat);
    },
    dateTime(iso: string | null | undefined, zone?: string | null) {
      if (!iso) return "";
      const tz = safeZone(zone, prefs.timezone);
      const date = new Date(iso);
      const { y, m, d } = partsInZone(date, tz);
      return `${renderDate(y, m, d, prefs.dateFormat)}, ${time(date, tz)}`;
    },
    timezone: prefs.timezone,
  };
}

export const initials = (name?: string | null) =>
  (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const todayInput = () => new Date().toISOString().slice(0, 10);
export const dayInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

/** ISO instant to the value format of <input type="datetime-local">, in the browser's zone. */
export function localInput(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export const localToIso = (value: string) => (value ? new Date(value).toISOString() : null);
export const splitList = (value: string) =>
  value
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
