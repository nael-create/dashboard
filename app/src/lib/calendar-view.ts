/**
 * Calculs d'affichage du calendrier (utilisables côté navigateur).
 * Toutes les dates sont des chaînes « YYYY-MM-DD » dans le fuseau du dashboard.
 */
import config from "@config";
import { addDays } from "./tz";
import { displayTimeZone } from "./display-tz";

export type View = "day" | "week" | "month";

export interface ViewEvent {
  id: string;
  calendarId: string;
  title: string;
  allDay: boolean;
  start: string;
  end: string;
  location?: string;
}

export { addDays };

export function todayInTz(tz = displayTimeZone()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

/** Lundi = 0 … dimanche = 6. */
function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export const startOfWeek = (iso: string) => addDays(iso, -weekdayIndex(iso));
export const startOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;

export function addMonths(iso: string, n: number): string {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

/** Jours affichés par une vue. En vue jour, on charge aussi les 7 jours suivants (« Ensuite »). */
export function visibleRange(view: View, cursor: string): { start: string; end: string; days: string[] } {
  let start: string;
  let count: number;
  if (view === "day") {
    start = cursor;
    count = 8;
  } else if (view === "week") {
    start = startOfWeek(cursor);
    count = 7;
  } else {
    start = startOfWeek(startOfMonth(cursor));
    count = 42;
  }
  const days = Array.from({ length: count }, (_, i) => addDays(start, i));
  return { start, end: addDays(start, count), days };
}

export function shift(view: View, cursor: string, dir: 1 | -1): string {
  if (view === "day") return addDays(cursor, dir);
  if (view === "week") return addDays(cursor, 7 * dir);
  return addMonths(startOfMonth(cursor), dir);
}

/** Jours (YYYY-MM-DD) couverts par un événement. */
export function eventDays(ev: ViewEvent): string[] {
  const first = ev.start.slice(0, 10);
  let last: string;
  if (ev.allDay) {
    last = addDays(ev.end, -1);
  } else {
    last = ev.end.slice(0, 10);
    // Un événement qui finit à minuit ne déborde pas sur le jour suivant.
    if (ev.end.slice(11) === "00:00" && ev.end > ev.start) last = addDays(last, -1);
  }
  if (last < first) last = first;
  const out: string[] = [];
  for (let d = first; d <= last && out.length < 62; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Regroupe les événements par jour ; journées entières en premier, puis par heure. */
export function bucketByDay<T extends ViewEvent>(events: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const ev of events) {
    for (const d of eventDays(ev)) {
      const list = map.get(d) ?? [];
      list.push(ev);
      map.set(d, list);
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
  }
  return map;
}

/** Libellé horaire d'un événement pour un jour donné. */
export function timeLabel(ev: ViewEvent, day: string): string {
  if (ev.allDay) return "Journée";
  const sDay = ev.start.slice(0, 10);
  const eDay = ev.end.slice(0, 10);
  const s = ev.start.slice(11);
  const e = ev.end.slice(11);
  if (sDay === day && (eDay === day || (e === "00:00" && eDay === addDays(day, 1)))) {
    return ev.end === ev.start ? s : `${s} – ${e}`;
  }
  if (sDay === day) return `${s} →`;
  if (eDay === day) return `→ ${e}`;
  return "Journée";
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(config.locale, { timeZone: "UTC", ...opts });
const toDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const fmtLongDay = (iso: string) => cap(fmt({ weekday: "long", day: "numeric", month: "long" }).format(toDate(iso)));
export const fmtShortDay = (iso: string) => cap(fmt({ weekday: "short", day: "numeric", month: "short" }).format(toDate(iso)));
export const fmtWeekday = (iso: string) => cap(fmt({ weekday: "short" }).format(toDate(iso)));
export const fmtDayNum = (iso: string) => String(Number(iso.slice(8)));

export function viewTitle(view: View, cursor: string): string {
  if (view === "day") return `${fmtLongDay(cursor)} ${cursor.slice(0, 4)}`;
  if (view === "month") return cap(fmt({ month: "long", year: "numeric" }).format(toDate(cursor)));
  const s = startOfWeek(cursor);
  const e = addDays(s, 6);
  const sameMonth = s.slice(0, 7) === e.slice(0, 7);
  const left = sameMonth ? fmtDayNum(s) : fmt({ day: "numeric", month: "short" }).format(toDate(s));
  return `${left} – ${fmt({ day: "numeric", month: "short", year: "numeric" }).format(toDate(e))}`;
}

export const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** Événement affiché ; `mergedCount` > 1 si plusieurs événements consécutifs ont été regroupés. */
export interface DisplayEvent extends ViewEvent {
  mergedCount?: number;
}

/**
 * Regroupe, POUR L'AFFICHAGE SEULEMENT, les événements consécutifs d'un même calendrier ayant
 * le même titre et le même lieu, quand l'un finit exactement quand le suivant commence
 * (ex. 08:00–09:00 + 09:00–10:00 + 10:00–11:00 → 08:00–11:00).
 * Les événements d'origine ne sont jamais modifiés (on renvoie des copies).
 */
export function mergeAdjacent(events: ViewEvent[]): DisplayEvent[] {
  const groups = new Map<string, ViewEvent[]>();
  for (const ev of events) {
    const key = [ev.calendarId, ev.allDay ? "1" : "0", ev.title, ev.location ?? ""].join("\u0000");
    const list = groups.get(key) ?? [];
    list.push(ev);
    groups.set(key, list);
  }
  const out: DisplayEvent[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
    let current = null as DisplayEvent | null;
    for (const ev of sorted) {
      if (current && current.end === ev.start && ev.end > ev.start) {
        current = { ...current, end: ev.end > current.end ? ev.end : current.end, mergedCount: (current.mergedCount ?? 1) + 1 };
        out[out.length - 1] = current;
      } else {
        current = { ...ev };
        out.push(current);
      }
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title, "fr"));
}
