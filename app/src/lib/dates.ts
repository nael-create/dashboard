import config from "@config";

/** Date du jour au format YYYY-MM-DD dans le fuseau configuré. */
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: config.timeZone }).format(now);
}

/** « vendredi 13 novembre » dans le fuseau configuré. */
export function formatLongToday(now = new Date()): string {
  const s = new Intl.DateTimeFormat(config.locale, {
    timeZone: config.timeZone, weekday: "long", day: "numeric", month: "long",
  }).format(now);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Formate une date ISO (YYYY-MM-DD) en « 13 nov. 2026 ». */
export function formatISODate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso ?? "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(config.locale, {
    timeZone: "UTC", day: "numeric", month: "short", year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Nombre de jours entre aujourd'hui (fuseau configuré) et une date ISO. */
export function daysUntil(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const a = Date.parse(`${todayISO()}T00:00:00Z`);
  const b = Date.parse(`${iso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
