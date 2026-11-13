import config from "@config";
import { displayTimeZone } from "./display-tz";

/** « il y a 12 min », « il y a 3 h », « hier », sinon « 13 nov. ». */
export function relativeTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.round((now - t) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "hier";
  if (d < 7) return `il y a ${d} j`;
  return new Intl.DateTimeFormat(config.locale, { timeZone: displayTimeZone(), day: "numeric", month: "short" }).format(new Date(t));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(config.locale, {
    timeZone: displayTimeZone(), weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}
